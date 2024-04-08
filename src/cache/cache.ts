import {
  DocumentNode,
  OperationDefinitionNode,
  OperationTypeNode,
} from "@0no-co/graphql.web";
import { Array, Option, Result } from "@swan-io/boxed";
import { P, match } from "ts-pattern";
import { Connection, Edge } from "../types";
import {
  DEEP_MERGE_DELETE,
  REQUESTED_KEYS,
  containsAll,
  deepMerge,
  isRecord,
  serializeVariables,
} from "../utils";

export const getCacheKeyFromJson = (json: unknown): Option<symbol> => {
  return match(json)
    .with(
      { __typename: P.select(P.union("Query", "Mutation", "Subscription")) },
      (name) => Option.Some(Symbol.for(name)),
    )
    .with(
      { __typename: P.select("name", P.string), id: P.select("id", P.string) },
      ({ name, id }) => Option.Some(Symbol.for(`${name}<${id}>`)),
    )
    .otherwise(() => Option.None());
};

export const getCacheKeyFromOperationNode = (
  operationNode: OperationDefinitionNode,
): Option<symbol> => {
  return match(operationNode.operation)
    .with(OperationTypeNode.QUERY, () => Option.Some(Symbol.for("Query")))
    .with(OperationTypeNode.SUBSCRIPTION, () =>
      Option.Some(Symbol.for("Subscription")),
    )
    .otherwise(() => Option.None());
};

export class ClientCache {
  cache = new Map<symbol, unknown>();
  operationCache = new Map<
    DocumentNode,
    Map<string, Option<Result<unknown, unknown>>>
  >();

  dump() {
    return this.cache;
  }

  getOperationFromCache(
    documentNode: DocumentNode,
    variables: Record<string, unknown>,
  ) {
    const serializedVariables = serializeVariables(variables);
    return Option.fromNullable(this.operationCache.get(documentNode))
      .flatMap((cache) => Option.fromNullable(cache.get(serializedVariables)))
      .flatMap((value) => value);
  }

  setOperationInCache(
    documentNode: DocumentNode,
    variables: Record<string, unknown>,
    data: Result<unknown, unknown>,
  ) {
    const serializedVariables = serializeVariables(variables);
    const documentCache = Option.fromNullable(
      this.operationCache.get(documentNode),
    ).getWithDefault(new Map());
    documentCache.set(serializedVariables, Option.Some(data));
    this.operationCache.set(documentNode, documentCache);
  }

  getFromCache(cacheKey: symbol, requestedKeys: Set<symbol>) {
    return this.get(cacheKey).flatMap((entry) => {
      if (isRecord(entry)) {
        if (containsAll(entry[REQUESTED_KEYS] as Set<symbol>, requestedKeys)) {
          return Option.Some(entry);
        } else {
          return Option.None();
        }
      } else {
        return Option.Some(entry);
      }
    });
  }

  getFromCacheWithoutKey(cacheKey: symbol) {
    return this.get(cacheKey).flatMap((entry) => {
      return Option.Some(entry);
    });
  }

  get(cacheKey: symbol): Option<unknown> {
    if (this.cache.has(cacheKey)) {
      return Option.Some(this.cache.get(cacheKey));
    } else {
      return Option.None();
    }
  }

  getOrDefault(cacheKey: symbol): unknown {
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as unknown;
    } else {
      return {};
    }
  }

  set(cacheKey: symbol, entry: unknown) {
    this.cache.set(cacheKey, entry);
  }

  cacheIfEligible<T>(value: T, requestedKeys: Set<symbol>): symbol | T {
    return match(getCacheKeyFromJson(value))
      .with(Option.P.Some(P.select()), (cacheKey) => {
        const existingEntry = this.getOrDefault(cacheKey);

        this.set(
          cacheKey,
          deepMerge(
            existingEntry,
            isRecord(value)
              ? { ...value, [REQUESTED_KEYS]: requestedKeys }
              : value,
          ),
        );
        return cacheKey;
      })
      .otherwise(() => value);
  }

  updateFieldInClosestCachedAncestor({
    originalFieldName,
    fieldNameWithArguments,
    value,
    path,
    ancestors,
    variables,
    rootTypename,
    selectedKeys,
  }: {
    originalFieldName: string;
    fieldNameWithArguments: symbol | string;
    value: unknown;
    path: PropertyKey[];
    ancestors: unknown[];
    variables: Record<string, unknown>;
    rootTypename: string;
    selectedKeys: Set<symbol>;
  }) {
    const ancestorsCopy = ancestors.concat();
    const pathCopy = path.concat();
    const writePath: PropertyKey[] = [];

    let ancestor;

    while ((ancestor = ancestorsCopy.pop())) {
      const maybeCacheKey = getCacheKeyFromJson(
        ancestorsCopy.length === 0
          ? { ...ancestor, __typename: rootTypename }
          : ancestor,
      );
      if (maybeCacheKey.isSome()) {
        const cacheKey = maybeCacheKey.get();
        const existingEntry = this.getOrDefault(cacheKey);

        if (isRecord(value) && !Array.isArray(value)) {
          if (
            typeof value.__typename === "string" &&
            value.__typename.endsWith("Connection")
          ) {
            value.__connectionCacheKey = cacheKey.description;
            value.__connectionCachePath = [
              [...writePath, fieldNameWithArguments].map((item) =>
                typeof item === "symbol" ? { symbol: item.description } : item,
              ),
            ];
            value.__connectionArguments = variables;
          }
          value[REQUESTED_KEYS] = selectedKeys;
        }

        const deepUpdate = writePath.reduce<unknown>(
          (acc, key) => {
            return {
              [key]: acc,
            };
          },
          // remote original field
          {
            [originalFieldName]: DEEP_MERGE_DELETE,
            [fieldNameWithArguments]: value,
          },
        );

        this.set(cacheKey, deepMerge(existingEntry, deepUpdate));

        // When the cached ancestor is found, remove
        break;
      }

      writePath.push(pathCopy.pop() as PropertyKey);
    }
  }

  unsafe__update<A>(
    cacheKey: symbol,
    path: (symbol | string)[],
    updater: (value: A) => A,
  ) {
    this.get(cacheKey).map((cachedAncestor) => {
      const value = path.reduce<Option<unknown>>(
        (acc, key) =>
          acc.flatMap((acc) =>
            Option.fromNullable(isRecord(acc) ? acc[key] : null),
          ),
        Option.fromNullable(cachedAncestor),
      );

      value.map((item) => {
        const deepUpdate = path.reduce<unknown>(
          (acc, key) => {
            return {
              [key]: acc,
            };
          },
          updater(item as A),
        );

        this.set(cacheKey, deepMerge(cachedAncestor, deepUpdate));
      });
    });
  }

  updateConnection<A>(
    connection: Connection<A>,
    config:
      | { prepend: Edge<A>[] }
      | { append: Edge<A>[] }
      | { remove: string[] },
  ) {
    match(connection as unknown)
      .with(
        {
          __connectionCacheKey: P.string,
          __connectionCachePath: P.array(
            P.array(P.union({ symbol: P.string }, P.string)),
          ),
        },
        ({ __connectionCacheKey, __connectionCachePath }) => {
          const cacheKey = Symbol.for(__connectionCacheKey);
          const cachePath = __connectionCachePath.map((path) =>
            path.map((item) =>
              typeof item === "string" ? item : Symbol.for(item.symbol),
            ),
          );
          const typenameSymbol = Symbol.for("__typename");
          const edgesSymbol = Symbol.for("edges");
          const nodeSymbol = Symbol.for("node");
          match(config)
            .with({ prepend: P.select(P.nonNullable) }, (edges) => {
              const firstPath = cachePath[0];
              if (firstPath != null) {
                this.unsafe__update(cacheKey, firstPath, (value) => {
                  if (!isRecord(value) || !Array.isArray(value[edgesSymbol])) {
                    return value;
                  }
                  return {
                    ...value,
                    [edgesSymbol]: [
                      ...Array.filterMap(edges, ({ node, __typename }) =>
                        getCacheKeyFromJson(node).flatMap((key) =>
                          // we can omit the requested fields here because the Connection<A> contrains the fields
                          this.getFromCacheWithoutKey(key).map(() => ({
                            [typenameSymbol]: __typename,
                            [nodeSymbol]: key,
                          })),
                        ),
                      ),
                      ...value[edgesSymbol],
                    ],
                  };
                });
              }
            })
            .with({ append: P.select(P.nonNullable) }, (edges) => {
              const lastPath = cachePath[cachePath.length - 1];
              if (lastPath != null) {
                this.unsafe__update(cacheKey, lastPath, (value) => {
                  if (!isRecord(value) || !Array.isArray(value[edgesSymbol])) {
                    return value;
                  }
                  return {
                    ...value,
                    [edgesSymbol]: [
                      ...value[edgesSymbol],
                      ...Array.filterMap(edges, ({ node, __typename }) =>
                        getCacheKeyFromJson(node).flatMap((key) =>
                          // we can omit the requested fields here because the Connection<A> contrains the fields
                          this.getFromCacheWithoutKey(key).map(() => ({
                            [typenameSymbol]: __typename,
                            [nodeSymbol]: key,
                          })),
                        ),
                      ),
                    ],
                  };
                });
              }
            })
            .with({ remove: P.select(P.array()) }, (nodeIds) => {
              cachePath.forEach((path) => {
                this.unsafe__update(cacheKey, path, (value) => {
                  return isRecord(value) && Array.isArray(value[edgesSymbol])
                    ? {
                        ...value,
                        [edgesSymbol]: value[edgesSymbol].filter((edge) => {
                          const node = edge[nodeSymbol] as symbol;
                          return !nodeIds.some((nodeId) => {
                            return node.description?.includes(`<${nodeId}>`);
                          });
                        }),
                      }
                    : value;
                });
              });
            })
            .exhaustive();
        },
      )
      .otherwise(() => {});
  }
}
