import { DocumentNode, SelectionSetNode, Kind } from "@0no-co/graphql.web";
import { ClientCache, getCacheKeyFromOperationNode } from "./cache";
import {
  getFieldName,
  getFieldNameWithArguments,
  getSelectedKeys,
} from "../graphql/ast";
import { match } from "ts-pattern";
import { Array, Option } from "@swan-io/boxed";
import { deepEqual, isRecord } from "../utils";

const getFromCacheOrReturnValue = (
  cache: ClientCache,
  valueOrKey: unknown,
  selectedKeys: Set<string>
): Option<unknown> =>
  typeof valueOrKey === "symbol"
    ? cache.getFromCache(valueOrKey, selectedKeys).flatMap(Option.fromNullable)
    : Option.Some(valueOrKey);

const STABILITY_CACHE = new WeakMap<DocumentNode, Map<string, unknown>>();

export const readOperationFromCache = (
  cache: ClientCache,
  document: DocumentNode,
  variables: Record<string, any>
) => {
  const traverse = (
    selections: SelectionSetNode,
    data: Record<PropertyKey, unknown>
  ): Option<any> => {
    return selections.selections.reduce((data, selection) => {
      return data.flatMap((data) =>
        match(selection)
          .with({ kind: Kind.FIELD }, (fieldNode) => {
            const originalFieldName = getFieldName(fieldNode);
            const fieldNameWithArguments = getFieldNameWithArguments(
              fieldNode,
              variables
            );
            if (data == undefined) {
              return Option.None();
            }
            const valueOrKeyFromCache = data[fieldNameWithArguments];

            if (valueOrKeyFromCache == undefined) {
              return Option.Some({
                ...data,
                [originalFieldName]: valueOrKeyFromCache,
              });
            }

            if (Array.isArray(valueOrKeyFromCache)) {
              const selectedKeys = getSelectedKeys(fieldNode);
              return Option.all(
                valueOrKeyFromCache.map((valueOrKey) => {
                  const value = getFromCacheOrReturnValue(
                    cache,
                    valueOrKey,
                    selectedKeys
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
                })
              ).map((result) => ({
                ...data,
                [originalFieldName]: result,
              }));
            } else {
              const selectedKeys = getSelectedKeys(fieldNode);

              const value = getFromCacheOrReturnValue(
                cache,
                valueOrKeyFromCache,
                selectedKeys
              );

              return value.flatMap((value) => {
                if (isRecord(value) && fieldNode.selectionSet != undefined) {
                  return traverse(
                    fieldNode.selectionSet,
                    value as Record<PropertyKey, unknown>
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
            return traverse(inlineFragmentNode.selectionSet, data);
          })
          .with({ kind: Kind.FRAGMENT_SPREAD }, () => {
            return Option.None();
          })
          .exhaustive()
      );
    }, Option.Some(data));
  };

  return Array.findMap(document.definitions, (definition) =>
    definition.kind === Kind.OPERATION_DEFINITION
      ? Option.Some(definition)
      : Option.None()
  )
    .flatMap((operation) =>
      getCacheKeyFromOperationNode(operation).map((cacheKey) => ({
        operation,
        cacheKey,
      }))
    )
    .flatMap(({ operation, cacheKey }) => {
      return cache
        .getFromCache(cacheKey, getSelectedKeys(operation))
        .map((cache) => ({ cache, operation }));
    })
    .flatMap(({ operation, cache }) => {
      return traverse(
        operation.selectionSet,
        cache as Record<PropertyKey, unknown>
      );
    })
    .map((data) => JSON.parse(JSON.stringify(data)))
    .flatMap((value) => {
      // We use a trick to return stable values, the document holds a WeakMap
      // that for each key (serialized variables), stores the last returned result.
      // If the last value deeply equals the previous one, return the previous one
      const serializedVariables = JSON.stringify(variables);
      const previous = Option.fromNullable(STABILITY_CACHE.get(document))
        .flatMap((byVariable) =>
          Option.fromNullable(byVariable.get(serializedVariables))
        )
        .flatMap((value) => value as Option<unknown>);

      if (previous.isSome() && deepEqual(value, previous.get())) {
        return previous;
      } else {
        const valueToCache = Option.Some(value);
        const documentCache = STABILITY_CACHE.get(document) ?? new Map();
        documentCache.set(serializedVariables, valueToCache);
        STABILITY_CACHE.set(document, documentCache);
        return valueToCache;
      }
    });
};
