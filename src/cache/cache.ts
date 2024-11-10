import { DocumentNode } from "@0no-co/graphql.web";
import { Array, Option, Result } from "@swan-io/boxed";
import { getCacheEntryKey } from "../json/cacheEntryKey";
import { Connection, Edge } from "../types";
import {
  CONNECTION_REF,
  EDGES_KEY,
  NODE_KEY,
  REQUESTED_KEYS,
  TYPENAME_KEY,
  containsAll,
  isRecord,
  serializeVariables,
} from "../utils";
import type { CacheEntry } from "./entry";

export type SchemaConfig = {
  interfaceToTypes: Record<string, string[]>;
};

type ConnectionInfo = {
  // useful for connection updates
  cacheEntry: CacheEntry;
  // to re-read from cache
  document: DocumentNode;
  variables: Record<string, unknown>;
  pathInQuery: PropertyKey[];
  fieldVariables: Record<string, unknown>;
};

export class ClientCache {
  cache = new Map<symbol, CacheEntry>();
  operationCache = new Map<
    DocumentNode,
    Map<string, Option<Result<unknown, unknown>>>
  >();

  interfaceToType: Record<string, Set<string>>;
  connectionCache: Map<number, ConnectionInfo>;
  connectionRefCount = -1;

  constructor(schemaConfig: SchemaConfig) {
    this.interfaceToType = Object.fromEntries(
      Object.entries(schemaConfig.interfaceToTypes).map(([key, value]) => [
        key,
        new Set(value),
      ]),
    );
    this.connectionCache = new Map<number, ConnectionInfo>();
  }

  registerConnectionInfo(info: ConnectionInfo) {
    const id = ++this.connectionRefCount;
    this.connectionCache.set(id, info);
    return id;
  }

  isTypeCompatible(typename: string, typeCondition: string) {
    if (typename === typeCondition) {
      return true;
    }
    const compatibleTypes = this.interfaceToType[typeCondition];
    if (compatibleTypes == undefined) {
      return false;
    }
    return compatibleTypes.has(typename);
  }

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
    ).getOr(new Map());
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

  getOrCreateEntry(cacheKey: symbol, defaultValue: CacheEntry): unknown {
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as unknown;
    } else {
      const entry = defaultValue;
      this.cache.set(cacheKey, entry);
      return entry;
    }
  }

  set(cacheKey: symbol, entry: CacheEntry) {
    this.cache.set(cacheKey, entry);
  }

  updateConnection<A>(
    connection: Connection<A>,
    config:
      | { prepend: Edge<A>[] }
      | { append: Edge<A>[] }
      | { remove: string[] },
  ) {
    if (connection == null) {
      return;
    }
    if (
      CONNECTION_REF in connection &&
      typeof connection[CONNECTION_REF] === "number"
    ) {
      const connectionConfig = this.connectionCache.get(
        connection[CONNECTION_REF],
      );
      if (connectionConfig == null) {
        return;
      }

      if ("prepend" in config) {
        const edges = config.prepend;
        connectionConfig.cacheEntry[EDGES_KEY] = [
          ...Array.filterMap(edges, ({ node, __typename }) =>
            getCacheEntryKey(node).flatMap((key) =>
              // we can omit the requested fields here because the Connection<A> contrains the fields
              this.getFromCacheWithoutKey(key).map(() => ({
                [TYPENAME_KEY]: __typename,
                [NODE_KEY]: key,
              })),
            ),
          ),
          ...(connectionConfig.cacheEntry[EDGES_KEY] as unknown[]),
        ];
        return;
      }

      if ("append" in config) {
        const edges = config.append;
        connectionConfig.cacheEntry[EDGES_KEY] = [
          ...(connectionConfig.cacheEntry[EDGES_KEY] as unknown[]),
          ...Array.filterMap(edges, ({ node, __typename }) =>
            getCacheEntryKey(node).flatMap((key) =>
              // we can omit the requested fields here because the Connection<A> contrains the fields
              this.getFromCacheWithoutKey(key).map(() => ({
                [TYPENAME_KEY]: __typename,
                [NODE_KEY]: key,
              })),
            ),
          ),
        ];
        return;
      }
      const nodeIds = config.remove;
      connectionConfig.cacheEntry[EDGES_KEY] = (
        connectionConfig.cacheEntry[EDGES_KEY] as unknown[]
      ).filter((edge) => {
        // @ts-expect-error fine
        const node = edge[NODE_KEY] as symbol;
        return !nodeIds.some((nodeId) => {
          return node.description?.includes(`<${nodeId}>`);
        });
      });
    }
  }
}
