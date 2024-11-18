import {
  Kind,
  OperationTypeNode,
  type DocumentNode,
  type FieldNode,
  type SelectionSetNode,
} from "@0no-co/graphql.web";
import {
  extractArguments,
  getFieldName,
  getFieldNameWithArguments,
} from "../graphql/ast";
import { getCacheEntryKey } from "../json/cacheEntryKey";
import { CONNECTION_REF, isRecord, REQUESTED_KEYS } from "../utils";
import { type ClientCache } from "./cache";
import { createEmptyCacheEntry, type CacheEntry } from "./entry";

export const writeOperationToCache = (
  cache: ClientCache,
  document: DocumentNode,
  response: unknown,
  variables: Record<string, unknown>,
) => {
  const registerConnection = (
    cacheEntry: CacheEntry,
    pathInQuery: PropertyKey[],
    fieldVariables: Record<string, unknown>,
  ) => {
    if (cacheEntry[CONNECTION_REF]) {
      return;
    }
    const id = cache.registerConnectionInfo({
      cacheEntry,
      variables,
      pathInQuery,
      fieldVariables,
      document,
    });
    cacheEntry[CONNECTION_REF] = id;
  };

  const cacheField = (
    field: FieldNode,
    parentJson: Record<PropertyKey, unknown>,
    parentCache: CacheEntry,
    path: PropertyKey[],
  ) => {
    const originalFieldName = getFieldName(field);
    const fieldNameWithArguments = getFieldNameWithArguments(field, variables);
    const fieldValue = parentJson[originalFieldName];

    parentCache[REQUESTED_KEYS].add(fieldNameWithArguments);

    // either scalar type with no selection, or a null/undefined value
    const subSelectionSet = field.selectionSet;
    if (subSelectionSet === undefined || fieldValue == null) {
      parentCache[fieldNameWithArguments] = fieldValue;
      return;
    }
    // array with selection
    if (Array.isArray(fieldValue)) {
      const arrayCache =
        parentCache[fieldNameWithArguments] ?? Array(fieldValue.length);
      if (parentCache[fieldNameWithArguments] == undefined) {
        parentCache[fieldNameWithArguments] = arrayCache;
      }
      fieldValue.forEach((item, index) => {
        if (item == null) {
          // @ts-expect-error It's fine
          arrayCache[index] = item;
          return;
        }
        const cacheKey = getCacheEntryKey(item);
        const cacheEntry = cacheKey.map((key) =>
          cache.getOrCreateEntry(key, createEmptyCacheEntry()),
        );
        const cacheObject = cacheEntry.getOr(
          // @ts-expect-error It's fine
          arrayCache[index] ?? createEmptyCacheEntry(),
        ) as CacheEntry;

        // @ts-expect-error It's fine
        const cacheValueInParent = cacheKey.getOr(cacheObject);
        // @ts-expect-error It's fine
        arrayCache[index] = cacheValueInParent;

        cacheSelectionSet(subSelectionSet, item, cacheObject, [
          ...path,
          originalFieldName,
          index,
        ]);
      });
      return;
    }
    // object with selection
    const record = fieldValue as Record<PropertyKey, unknown>;
    const cacheKey = getCacheEntryKey(record);
    const cacheEntry = cacheKey.map((key) =>
      cache.getOrCreateEntry(key, createEmptyCacheEntry()),
    );
    const cacheObject = cacheEntry.getOr(
      parentCache[fieldNameWithArguments] ?? createEmptyCacheEntry(),
    ) as CacheEntry;

    // @ts-expect-error It's fine
    const cacheValueInParent = cacheKey.getOr(cacheObject);
    parentCache[fieldNameWithArguments] = cacheValueInParent;

    if (
      typeof record.__typename === "string" &&
      record.__typename.endsWith("Connection")
    ) {
      registerConnection(
        cacheObject,
        [...path, originalFieldName],
        extractArguments(field, variables),
      );
    }

    return cacheSelectionSet(subSelectionSet, record, cacheObject, [
      ...path,
      originalFieldName,
    ]);
  };

  const cacheSelectionSet = (
    selectionSet: SelectionSetNode,
    json: Record<PropertyKey, unknown>,
    cached: CacheEntry,
    path: PropertyKey[],
  ) => {
    for (const selection of selectionSet.selections) {
      switch (selection.kind) {
        case Kind.INLINE_FRAGMENT:
          cacheSelectionSet(selection.selectionSet, json, cached, path);
          continue;
        case Kind.FIELD:
          cacheField(selection, json, cached, path);
          continue;
        default:
          continue;
      }
    }
  };

  document.definitions.forEach((definition) => {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      // Root __typename can vary, but we can't guess it from the document alone
      const operationName =
        definition.operation === OperationTypeNode.QUERY
          ? "Query"
          : definition.operation === OperationTypeNode.SUBSCRIPTION
            ? "Subscription"
            : "Mutation";

      if (!isRecord(response)) {
        return;
      }

      const cacheEntry = cache.getOrCreateEntry(
        Symbol.for(operationName),
        createEmptyCacheEntry(),
      );
      return cacheSelectionSet(
        definition.selectionSet,
        response,
        cacheEntry as CacheEntry,
        [],
      );
    }
  });
};
