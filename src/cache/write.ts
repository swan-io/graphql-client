import {
  DocumentNode,
  Kind,
  OperationTypeNode,
  SelectionSetNode,
} from "@0no-co/graphql.web";
import { match } from "ts-pattern";
import {
  extractArguments,
  getFieldName,
  getFieldNameWithArguments,
  getSelectedKeys,
} from "../graphql/ast";
import { isRecord } from "../utils";
import { ClientCache } from "./cache";

export const writeOperationToCache = (
  cache: ClientCache,
  document: DocumentNode,
  response: unknown,
  variables: Record<string, unknown>,
) => {
  const traverse = (
    selections: SelectionSetNode,
    data: unknown[],
    path: PropertyKey[] = [],
    rootTypename: string,
  ) => {
    selections.selections.forEach((selection) => {
      match(selection)
        .with({ kind: Kind.FIELD }, (fieldNode) => {
          const originalFieldName = getFieldName(fieldNode);
          const fieldNameWithArguments = getFieldNameWithArguments(
            fieldNode,
            variables,
          );
          const fieldArguments = extractArguments(fieldNode, variables);

          const parent = data.at(-1) as Record<PropertyKey, unknown>;
          const fieldValue = parent[originalFieldName];
          const selectedKeys = getSelectedKeys(fieldNode, variables);

          if (fieldValue != undefined) {
            if (Array.isArray(fieldValue)) {
              cache.updateFieldInClosestCachedAncestor({
                originalFieldName,
                fieldNameWithArguments,
                value: fieldValue,
                path,
                ancestors: data,
                variables: fieldArguments,
                rootTypename,
                selectedKeys,
              });

              fieldValue.forEach((item: unknown, index: number) => {
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
                  rootTypename,
                  selectedKeys,
                });

                if (isRecord(item) && !Array.isArray(item)) {
                  traverse(
                    fieldNode.selectionSet!,
                    [...data, fieldValue, item],
                    [...path, fieldNameWithArguments, index.toString()],
                    rootTypename,
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
                rootTypename,
                selectedKeys,
              });

              if (isRecord(fieldValue) && fieldNode.selectionSet != undefined) {
                traverse(
                  fieldNode.selectionSet,
                  [...data, fieldValue],
                  [...path, fieldNameWithArguments],
                  rootTypename,
                );
              }
            }
          } else {
            if (originalFieldName in parent) {
              cache.updateFieldInClosestCachedAncestor({
                originalFieldName,
                fieldNameWithArguments,
                value: fieldValue,
                path,
                ancestors: data,
                variables: fieldArguments,
                rootTypename,
                selectedKeys,
              });
            }
          }
        })
        .with({ kind: Kind.INLINE_FRAGMENT }, (inlineFragmentNode) => {
          traverse(inlineFragmentNode.selectionSet, data, path, rootTypename);
        })
        .with({ kind: Kind.FRAGMENT_SPREAD }, () => {
          // ignore, those are stripped
        })
        .exhaustive();
    });
  };

  document.definitions.forEach((definition) => {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      // Root __typename can vary, but we can't guess it from the document alone
      const rootTypename = match(definition.operation)
        .with(OperationTypeNode.QUERY, () => "Query")
        .with(OperationTypeNode.SUBSCRIPTION, () => "Subscription")
        .with(OperationTypeNode.MUTATION, () => "Mutation")
        .exhaustive();

      cache.cacheIfEligible(
        isRecord(response)
          ? {
              ...response,
              __typename: rootTypename,
            }
          : response,
        getSelectedKeys(definition, variables),
      );
      traverse(definition.selectionSet, [response], [], rootTypename);
    }
  });

  return cache;
};
