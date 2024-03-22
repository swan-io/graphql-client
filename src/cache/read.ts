import { DocumentNode, Kind, SelectionSetNode } from "@0no-co/graphql.web";
import { Array, Option, Result } from "@swan-io/boxed";
import { match } from "ts-pattern";
import {
  getFieldName,
  getFieldNameWithArguments,
  getSelectedKeys,
} from "../graphql/ast";
import {
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
  return typeof valueOrKey === "symbol"
    ? cache.getFromCache(valueOrKey, selectedKeys).flatMap(Option.fromNullable)
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

            const cacheHasKey = hasOwnProperty.call(
              data,
              fieldNameWithArguments,
            );

            if (!cacheHasKey) {
              return Option.None();
            }

            // @ts-expect-error `data` is indexable at this point
            const valueOrKeyFromCache = data[fieldNameWithArguments];

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
