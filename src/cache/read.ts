import {
  DocumentNode,
  InlineFragmentNode,
  Kind,
  OperationDefinitionNode,
  SelectionNode,
  SelectionSetNode,
} from "@0no-co/graphql.web";
import { Array, Option, Result } from "@swan-io/boxed";
import { P, match } from "ts-pattern";
import {
  addIdIfPreviousSelected,
  getFieldName,
  getFieldNameWithArguments,
  getSelectedKeys,
} from "../graphql/ast";
import {
  REQUESTED_KEYS,
  containsAll,
  deepEqual,
  hasOwnProperty,
  isRecord,
  serializeVariables,
} from "../utils";
import { ClientCache, getCacheKeyFromOperationNode } from "./cache";

const getFromCacheOrReturnValue = (
  cache: ClientCache,
  valueOrKey: unknown,
  selectedKeys: Set<symbol>,
): Option<unknown> => {
  if (typeof valueOrKey === "symbol") {
    return cache
      .getFromCache(valueOrKey, selectedKeys)
      .flatMap(Option.fromNullable);
  }
  if (
    isRecord(valueOrKey) &&
    REQUESTED_KEYS in valueOrKey &&
    valueOrKey[REQUESTED_KEYS] instanceof Set
  ) {
    if (containsAll(valueOrKey[REQUESTED_KEYS], selectedKeys)) {
      return Option.Some(valueOrKey);
    } else {
      return Option.None();
    }
  }
  return Option.Some(valueOrKey);
};

const getFromCacheOrReturnValueWithoutKeyFilter = (
  cache: ClientCache,
  valueOrKey: unknown,
): Option<unknown> => {
  return typeof valueOrKey === "symbol"
    ? cache.getFromCacheWithoutKey(valueOrKey).flatMap(Option.fromNullable)
    : Option.Some(valueOrKey);
};

const STABILITY_CACHE = new WeakMap<DocumentNode, Map<string, unknown>>();

export const readOperationFromCache = (
  cache: ClientCache,
  document: DocumentNode,
  variables: Record<string, unknown>,
) => {
  const traverse = (
    selections: SelectionSetNode,
    data: Record<PropertyKey, unknown>,
  ): Option<unknown> => {
    return selections.selections.reduce<Option<unknown>>((data, selection) => {
      return data.flatMap((data) =>
        match(selection)
          .with({ kind: Kind.FIELD }, (fieldNode) => {
            const originalFieldName = getFieldName(fieldNode);
            const fieldNameWithArguments = getFieldNameWithArguments(
              fieldNode,
              variables,
            );
            if (data == undefined) {
              return Option.None();
            }

            const cacheHasKey =
              hasOwnProperty.call(data, originalFieldName) ||
              hasOwnProperty.call(data, fieldNameWithArguments);

            if (!cacheHasKey) {
              return Option.None();
            }

            // in case a the data is read across multiple selections, get the actual one if generated,
            // otherwise, read from cache (e.g. fragments)
            const valueOrKeyFromCache =
              // @ts-expect-error `data` is indexable at this point
              originalFieldName in data
                ? // @ts-expect-error `data` is indexable at this point
                  data[originalFieldName]
                : // @ts-expect-error `data` is indexable at this point
                  data[fieldNameWithArguments];

            if (valueOrKeyFromCache == undefined) {
              return Option.Some({
                ...data,
                [originalFieldName]: valueOrKeyFromCache,
              });
            }

            if (Array.isArray(valueOrKeyFromCache)) {
              const selectedKeys = getSelectedKeys(fieldNode, variables);
              return Option.all(
                valueOrKeyFromCache.map((valueOrKey) => {
                  const value = getFromCacheOrReturnValue(
                    cache,
                    valueOrKey,
                    selectedKeys,
                  );

                  return value.flatMap((value) => {
                    if (
                      isRecord(value) &&
                      fieldNode.selectionSet != undefined
                    ) {
                      return traverse(fieldNode.selectionSet, value);
                    } else {
                      return Option.Some(value);
                    }
                  });
                }),
              ).map((result) => ({
                ...data,
                [originalFieldName]: result,
              }));
            } else {
              const selectedKeys = getSelectedKeys(fieldNode, variables);

              const value = getFromCacheOrReturnValue(
                cache,
                valueOrKeyFromCache,
                selectedKeys,
              );

              return value.flatMap((value) => {
                if (isRecord(value) && fieldNode.selectionSet != undefined) {
                  return traverse(
                    fieldNode.selectionSet,
                    value as Record<PropertyKey, unknown>,
                  ).map((result) => ({
                    ...data,
                    [originalFieldName]: result,
                  }));
                } else {
                  return Option.Some({ ...data, [originalFieldName]: value });
                }
              });
            }
          })
          .with({ kind: Kind.INLINE_FRAGMENT }, (inlineFragmentNode) => {
            const typeCondition = inlineFragmentNode.typeCondition?.name.value;
            const dataTypename = match(data)
              .with({ __typename: P.select(P.string) }, (name) => name)
              .with(
                { __typename: P.array({ __typename: P.select(P.string) }) },
                (name) => name,
              )
              .otherwise(() => undefined);

            if (typeCondition != null && dataTypename != null) {
              if (dataTypename === typeCondition) {
                return traverse(
                  inlineFragmentNode.selectionSet,
                  data as Record<PropertyKey, unknown>,
                );
              } else {
                if (
                  inlineFragmentNode.selectionSet.selections.some(
                    (selection) => selection.kind === Kind.INLINE_FRAGMENT,
                  )
                ) {
                  return traverse(
                    {
                      ...inlineFragmentNode.selectionSet,
                      selections:
                        inlineFragmentNode.selectionSet.selections.filter(
                          (selection) => {
                            if (selection.kind === Kind.INLINE_FRAGMENT) {
                              const typeCondition =
                                selection.typeCondition?.name.value;
                              return typeCondition === dataTypename;
                            }
                            return true;
                          },
                        ),
                    },
                    data as Record<PropertyKey, unknown>,
                  );
                } else {
                  return Option.Some(data);
                }
              }
            }
            return traverse(
              inlineFragmentNode.selectionSet,
              data as Record<PropertyKey, unknown>,
            );
          })
          .with({ kind: Kind.FRAGMENT_SPREAD }, () => {
            return Option.None();
          })
          .exhaustive(),
      );
    }, Option.Some(data));
  };

  return Array.findMap(document.definitions, (definition) =>
    definition.kind === Kind.OPERATION_DEFINITION
      ? Option.Some(definition)
      : Option.None(),
  )
    .flatMap((operation) =>
      getCacheKeyFromOperationNode(operation).map((cacheKey) => ({
        operation,
        cacheKey,
      })),
    )
    .flatMap(({ operation, cacheKey }) => {
      return cache
        .getFromCache(cacheKey, getSelectedKeys(operation, variables))
        .map((cache) => ({ cache, operation }));
    })
    .flatMap(({ operation, cache }) => {
      return traverse(
        operation.selectionSet,
        cache as Record<PropertyKey, unknown>,
      );
    })
    .map((data) => JSON.parse(JSON.stringify(data)))
    .flatMap((value) => {
      // We use a trick to return stable values, the document holds a WeakMap
      // that for each key (serialized variables), stores the last returned result.
      // If the last value deeply equals the previous one, return the previous one
      const serializedVariables = serializeVariables(variables);
      const previous = Option.fromNullable(STABILITY_CACHE.get(document))
        .flatMap((byVariable) =>
          Option.fromNullable(byVariable.get(serializedVariables)),
        )
        .flatMap((value) => value as Option<Result<unknown, unknown>>);

      if (
        previous
          .flatMap((previous) => previous.toOption())
          .map((previous) => deepEqual(value, previous))
          .getWithDefault(false)
      ) {
        return previous;
      } else {
        const valueToCache = Option.Some(Result.Ok(value));
        const documentCache = STABILITY_CACHE.get(document) ?? new Map();
        documentCache.set(serializedVariables, valueToCache);
        STABILITY_CACHE.set(document, documentCache);
        return valueToCache;
      }
    });
};

export const optimizeQuery = (
  cache: ClientCache,
  document: DocumentNode,
  variables: Record<string, unknown>,
): Option<DocumentNode> => {
  const traverse = (
    selections: SelectionSetNode,
    data: Record<PropertyKey, unknown>,
    parentSelectedKeys: Set<symbol>,
  ): Option<SelectionSetNode> => {
    const nextSelections = Array.filterMap<SelectionNode, SelectionNode>(
      selections.selections,
      (selection) => {
        return match(selection)
          .with({ kind: Kind.FIELD }, (fieldNode) => {
            const fieldNameWithArguments = getFieldNameWithArguments(
              fieldNode,
              variables,
            );

            if (data == undefined) {
              return Option.Some(fieldNode);
            }

            const cacheHasKey = hasOwnProperty.call(
              data,
              fieldNameWithArguments,
            );

            if (!cacheHasKey) {
              return Option.Some(fieldNode);
            }

            if (parentSelectedKeys.has(fieldNameWithArguments)) {
              const valueOrKeyFromCache = data[fieldNameWithArguments];

              const subFieldSelectedKeys = getSelectedKeys(
                fieldNode,
                variables,
              );
              if (Array.isArray(valueOrKeyFromCache)) {
                return valueOrKeyFromCache.reduce((acc, valueOrKey) => {
                  const value = getFromCacheOrReturnValueWithoutKeyFilter(
                    cache,
                    valueOrKey,
                  );

                  if (value.isNone()) {
                    return Option.Some(fieldNode);
                  }

                  const originalSelectionSet = fieldNode.selectionSet;
                  if (originalSelectionSet != null) {
                    return traverse(
                      originalSelectionSet,
                      value.get() as Record<PropertyKey, unknown>,
                      subFieldSelectedKeys,
                    ).map((selectionSet) => ({
                      ...fieldNode,
                      selectionSet: addIdIfPreviousSelected(
                        originalSelectionSet,
                        selectionSet,
                      ),
                    }));
                  } else {
                    return acc;
                  }
                }, Option.None());
              } else {
                const value = getFromCacheOrReturnValueWithoutKeyFilter(
                  cache,
                  valueOrKeyFromCache,
                );

                if (value.isNone()) {
                  return Option.Some(fieldNode);
                }

                const originalSelectionSet = fieldNode.selectionSet;
                if (originalSelectionSet != null) {
                  return traverse(
                    originalSelectionSet,
                    value.get() as Record<PropertyKey, unknown>,
                    subFieldSelectedKeys,
                  ).map((selectionSet) => ({
                    ...fieldNode,
                    selectionSet: addIdIfPreviousSelected(
                      originalSelectionSet,
                      selectionSet,
                    ),
                  }));
                } else {
                  return Option.None();
                }
              }
            } else {
              return Option.Some(fieldNode);
            }
          })
          .with({ kind: Kind.INLINE_FRAGMENT }, (inlineFragmentNode) => {
            return traverse(
              inlineFragmentNode.selectionSet,
              data as Record<PropertyKey, unknown>,
              parentSelectedKeys,
            ).map(
              (selectionSet) =>
                ({ ...inlineFragmentNode, selectionSet }) as InlineFragmentNode,
            );
          })
          .with({ kind: Kind.FRAGMENT_SPREAD }, () => {
            return Option.None();
          })
          .exhaustive();
      },
    );
    if (nextSelections.length > 0) {
      return Option.Some({ ...selections, selections: nextSelections });
    } else {
      return Option.None();
    }
  };

  return Array.findMap(document.definitions, (definition) =>
    definition.kind === Kind.OPERATION_DEFINITION
      ? Option.Some(definition)
      : Option.None(),
  )
    .flatMap((operation) =>
      getCacheKeyFromOperationNode(operation).map((cacheKey) => ({
        operation,
        cacheKey,
      })),
    )
    .flatMap(({ operation, cacheKey }) => {
      const selectedKeys = getSelectedKeys(operation, variables);
      return cache
        .getFromCache(cacheKey, selectedKeys)
        .map((cache) => ({ cache, operation, selectedKeys }));
    })
    .flatMap(({ operation, cache, selectedKeys }) => {
      return traverse(
        operation.selectionSet,
        cache as Record<PropertyKey, unknown>,
        selectedKeys,
      ).map((selectionSet) => ({
        ...document,
        definitions: [
          {
            ...operation,
            selectionSet,
          } as OperationDefinitionNode,
        ],
      }));
    });
};
