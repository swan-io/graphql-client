import { DocumentNode, SelectionSetNode, Kind } from "@0no-co/graphql.web";
import { ClientCache } from "./cache";
import {
  extractArguments,
  getFieldName,
  getFieldNameWithArguments,
  getSelectedKeys,
} from "../graphql/ast";
import { match } from "ts-pattern";
import { isRecord } from "../utils";

export const writeOperationToCache = (
  cache: ClientCache,
  document: DocumentNode,
  response: any,
  variables: Record<string, any>
) => {
  const traverse = (
    selections: SelectionSetNode,
    data: any[],
    path: PropertyKey[] = []
  ) => {
    selections.selections.forEach((selection) => {
      match(selection)
        .with({ kind: Kind.FIELD }, (fieldNode) => {
          const originalFieldName = getFieldName(fieldNode);
          const fieldNameWithArguments = getFieldNameWithArguments(
            fieldNode,
            variables
          );
          const fieldArguments = extractArguments(fieldNode, variables);

          const fieldValue = data.at(-1)[originalFieldName];
          const selectedKeys = getSelectedKeys(fieldNode, variables);

          if (fieldValue != undefined) {
            if (Array.isArray(fieldValue)) {
              fieldValue.forEach((item: any, index: number) => {
                const value = cache.cacheIfEligible(item, selectedKeys);

                const nextValue = Array(fieldValue.length);
                nextValue[index] = value;

                cache.updateFieldInClosestCachedAncestor({
                  originalFieldName,
                  fieldNameWithArguments,
                  value: nextValue,
                  path,
                  ancestors: data,
                  variables: fieldArguments,
                });

                if (isRecord(item) && !Array.isArray(item)) {
                  traverse(
                    fieldNode.selectionSet!,
                    [...data, fieldValue, item],
                    [...path, fieldNameWithArguments, index.toString()]
                  );
                }
              });
            } else {
              const value = cache.cacheIfEligible(fieldValue, selectedKeys);

              cache.updateFieldInClosestCachedAncestor({
                originalFieldName,
                fieldNameWithArguments,
                value,
                path,
                ancestors: data,
                variables: fieldArguments,
              });

              if (isRecord(fieldValue) && fieldNode.selectionSet != undefined) {
                traverse(
                  fieldNode.selectionSet,
                  [...data, fieldValue],
                  [...path, fieldNameWithArguments]
                );
              }
            }
          } else {
            cache.updateFieldInClosestCachedAncestor({
              originalFieldName,
              fieldNameWithArguments,
              value: fieldValue,
              path,
              ancestors: data,
              variables: fieldArguments,
            });
          }
        })
        .with({ kind: Kind.INLINE_FRAGMENT }, (inlineFragmentNode) => {
          traverse(inlineFragmentNode.selectionSet, data, path);
        })
        .with({ kind: Kind.FRAGMENT_SPREAD }, () => {
          // ignore, those are stripped
        })
        .exhaustive();
    });
  };

  document.definitions.forEach((definition) => {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      cache.cacheIfEligible(response, getSelectedKeys(definition, variables));
      traverse(definition.selectionSet, [response]);
    }
  });

  return cache;
};
