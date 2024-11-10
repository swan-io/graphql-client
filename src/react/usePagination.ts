import { Array, AsyncData, Option, Result } from "@swan-io/boxed";
import { useCallback, useContext, useRef, useSyncExternalStore } from "react";
import { Connection } from "../types";
import { CONNECTION_REF, deepEqual } from "../utils";
import { ClientContext } from "./ClientContext";

type mode = "before" | "after";

const mergeConnection = <A, T extends Connection<A>>(
  previous: T,
  next: T,
  mode: mode,
): T => {
  if (next == null) {
    return next;
  }
  if (previous == null) {
    return next;
  }

  if (
    mode === "after" &&
    next.pageInfo.endCursor === previous.pageInfo.endCursor
  ) {
    return previous;
  }
  if (
    mode === "before" &&
    next.pageInfo.startCursor === previous.pageInfo.startCursor
  ) {
    return previous;
  }

  return {
    ...next,
    edges:
      mode === "before"
        ? [...(next.edges ?? []), ...(previous.edges ?? [])]
        : [...(previous.edges ?? []), ...(next.edges ?? [])],
    pageInfo:
      mode === "before"
        ? {
            hasPreviousPage: next.pageInfo.hasPreviousPage,
            startCursor: next.pageInfo.startCursor,
            hasNextPage: previous.pageInfo.hasNextPage,
            endCursor: previous.pageInfo.endCursor,
          }
        : {
            hasPreviousPage: previous.pageInfo.hasPreviousPage,
            startCursor: previous.pageInfo.startCursor,
            hasNextPage: next.pageInfo.hasNextPage,
            endCursor: next.pageInfo.endCursor,
          },
  };
};

const createPaginationHook = (direction: mode) => {
  return <A, T extends Connection<A>>(connection: T): T => {
    const client = useContext(ClientContext);
    const connectionRefs = useRef<number[]>([]);
    const lastReturnedValueRef = useRef<Option<T[]>>(Option.None());

    if (connection == null) {
      connectionRefs.current = [];
    } else {
      if (
        CONNECTION_REF in connection &&
        typeof connection[CONNECTION_REF] === "number" &&
        !connectionRefs.current.includes(connection[CONNECTION_REF])
      ) {
        connectionRefs.current.push(connection[CONNECTION_REF]);
      }
    }

    // Get fresh data from cache
    const getSnapshot = useCallback(() => {
      const value = Option.all(
        Array.filterMap(connectionRefs.current, (id) =>
          Option.fromNullable(client.cache.connectionCache.get(id)),
        ).flatMap((info) =>
          client
            .readFromCache(info.document, info.variables, {})
            .map((query) =>
              query.map((query) => ({ query, pathInQuery: info.pathInQuery })),
            ),
        ),
      )
        .map(Result.all)
        .flatMap((x) => x.toOption())
        .map((queries) =>
          queries.map(({ query, pathInQuery }) => {
            return pathInQuery.reduce(
              (acc, key) =>
                acc != null && typeof acc === "object" && key in acc
                  ? // @ts-expect-error indexable
                    acc[key]
                  : null,
              query,
            );
          }),
        ) as Option<T[]>;
      if (!deepEqual(value, lastReturnedValueRef.current)) {
        lastReturnedValueRef.current = value;
        return value;
      } else {
        return lastReturnedValueRef.current;
      }
    }, [client]);

    const data = useSyncExternalStore(
      (func) => client.subscribe(func),
      getSnapshot,
    ) as Option<T[]>;

    return data
      .map(([first, ...rest]) =>
        rest.reduce((acc, item) => {
          return mergeConnection(acc, item, direction);
        }, first),
      )
      .getOr(connection) as T;
  };
};

export const useForwardPagination = createPaginationHook("after");

export const useBackwardPagination = createPaginationHook("before");

export const useForwardAsyncDataPagination = <
  A,
  E,
  T extends AsyncData<Result<Connection<A>, E>>,
>(
  connection: T,
): T => {
  const data = connection
    .toOption()
    .flatMap((result) => result.toOption())
    .toNull();
  const patchedData = useForwardPagination(data);
  return connection.mapOk(() => patchedData) as T;
};

export const useBackwardAsyncDataPagination = <
  A,
  E,
  T extends AsyncData<Result<Connection<A>, E>>,
>(
  connection: T,
): T => {
  const data = connection
    .toOption()
    .flatMap((result) => result.toOption())
    .toNull();
  const patchedData = useBackwardPagination(data);
  return connection.mapOk(() => patchedData) as T;
};
