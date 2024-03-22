import {
  DocumentNode,
  OperationDefinitionNode,
  OperationTypeNode,
} from "@0no-co/graphql.web";
import { Option, Result } from "@swan-io/boxed";
import { P, match } from "ts-pattern";
import {
  DEEP_MERGE_DELETE,
  containsAll,
  deepMerge,
  isRecord,
  serializeVariables,
} from "../utils";

type CacheEntry = {
  requestedKeys: Set<symbol>;
  value: unknown;
};

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

const mergeCacheEntries = (a: CacheEntry, b: CacheEntry): CacheEntry => {
  return {
    requestedKeys: new Set([
      ...a.requestedKeys.values(),
      ...b.requestedKeys.values(),
    ]),
    value: deepMerge(a.value, b.value),
  };
};

export class ClientCache {
  cache = new Map<symbol, CacheEntry>();
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
      if (containsAll(entry.requestedKeys, requestedKeys)) {
        return Option.Some(entry.value);
      } else {
        return Option.None();
      }
    });
  }

  getFromCacheWithoutKey(cacheKey: symbol) {
    return this.get(cacheKey).flatMap((entry) => {
      return Option.Some(entry.value);
    });
  }

  get(cacheKey: symbol): Option<CacheEntry> {
    if (this.cache.has(cacheKey)) {
      return Option.Some(this.cache.get(cacheKey) as CacheEntry);
    } else {
      return Option.None();
    }
  }

  getOrDefault(cacheKey: symbol): CacheEntry {
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as CacheEntry;
    } else {
      return {
        requestedKeys: new Set(),
        value: {},
      };
    }
  }

  set(cacheKey: symbol, entry: CacheEntry) {
    this.cache.set(cacheKey, entry);
  }

  cacheIfEligible<T>(value: T, requestedKeys: Set<symbol>): symbol | T {
    return match(getCacheKeyFromJson(value))
      .with(Option.P.Some(P.select()), (cacheKey) => {
        const existingEntry = this.getOrDefault(cacheKey);
        this.cache.set(
          cacheKey,
          mergeCacheEntries(existingEntry, {
            requestedKeys,
            value,
          }),
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
  }: {
    originalFieldName: string;
    fieldNameWithArguments: symbol | string;
    value: unknown;
    path: PropertyKey[];
    ancestors: unknown[];
    variables: Record<string, unknown>;
  }) {
    const ancestorsCopy = ancestors.concat();
    const pathCopy = path.concat();
    const writePath: PropertyKey[] = [];

    let ancestor;

    while ((ancestor = ancestorsCopy.pop())) {
      const maybeCacheKey = getCacheKeyFromJson(ancestor);
      if (maybeCacheKey.isSome()) {
        const cacheKey = maybeCacheKey.get();
        const existingEntry = this.getOrDefault(cacheKey);

        if (
          isRecord(value) &&
          typeof value.__typename === "string" &&
          value.__typename.endsWith("Connection")
        ) {
          value.__connectionArguments = variables;
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

        this.set(
          cacheKey,
          mergeCacheEntries(existingEntry, {
            requestedKeys: new Set(),
            value: deepUpdate,
          }),
        );

        // When the cached ancestor is found, remove
        break;
      }

      writePath.push(pathCopy.pop() as PropertyKey);
    }
  }
}
