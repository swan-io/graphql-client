import { DocumentNode } from "@0no-co/graphql.web";
import { Option, Result } from "@swan-io/boxed";
import { useCallback, useContext, useRef, useSyncExternalStore } from "react";
import { match } from "ts-pattern";
import { Connection } from "../types";
import { deepEqual, isRecord, serializeVariables } from "../utils";
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
  if ("__connectionArguments" in next && isRecord(next.__connectionArguments)) {
    if (next.__connectionArguments[mode] == null) {
      return next;
    }
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
    __connectionCachePath: match(mode)
      .with("before", () => [
        ...("__connectionCachePath" in next &&
        Array.isArray(next.__connectionCachePath)
          ? next.__connectionCachePath
          : []),
        ...("__connectionCachePath" in previous &&
        Array.isArray(previous.__connectionCachePath)
          ? previous.__connectionCachePath
          : []),
      ])
      .with("after", () => [
        ...("__connectionCachePath" in previous &&
        Array.isArray(previous.__connectionCachePath)
          ? previous.__connectionCachePath
          : []),
        ...("__connectionCachePath" in next &&
        Array.isArray(next.__connectionCachePath)
          ? next.__connectionCachePath
          : []),
      ])
      .exhaustive(),
    edges: match(mode)
      .with("before", () => [...(next.edges ?? []), ...(previous.edges ?? [])])
      .with("after", () => [...(previous.edges ?? []), ...(next.edges ?? [])])
      .exhaustive(),
    pageInfo: match(mode)
      .with("before", () => ({
        hasPreviousPage: next.pageInfo.hasPreviousPage,
        startCursor: next.pageInfo.startCursor,
        hasNextPage: previous.pageInfo.hasNextPage,
        endCursor: previous.pageInfo.endCursor,
      }))
      .with("after", () => ({
        hasPreviousPage: previous.pageInfo.hasPreviousPage,
        startCursor: previous.pageInfo.startCursor,
        hasNextPage: next.pageInfo.hasNextPage,
        endCursor: next.pageInfo.endCursor,
      }))
      .exhaustive(),
  };
};

const createPaginationHook = (direction: mode) => {
  return <A, T extends Connection<A>>(connection: T): T => {
    const client = useContext(ClientContext);
    const connectionArgumentsRef = useRef<[string, Record<string, unknown>][]>(
      [],
    );

    if (connection != null && "__connectionQueryArguments" in connection) {
      const arg = connection.__connectionQueryArguments as Record<
        string,
        unknown
      >;
      const serializedArg = serializeVariables(arg);
      if (
        !connectionArgumentsRef.current.find(
          ([serialized]) => serializedArg === serialized,
        )
      ) {
        connectionArgumentsRef.current = [
          ...connectionArgumentsRef.current,
          [serializedArg, arg],
        ];
      }
    }

    const jsonPath = useRef(
      connection != null && "__connectionJsonPath" in connection
        ? (connection.__connectionJsonPath as string[])
        : [],
    );

    const documentNode =
      connection != null && "__connectionDocumentNode" in connection
        ? (connection.__connectionDocumentNode as DocumentNode)
        : undefined;

    const lastReturnedValueRef = useRef<Option<T[]>>(Option.None());

    // Get fresh data from cache
    const getSnapshot = useCallback(() => {
      if (documentNode == null) {
        return Option.None();
      }
      const value = Option.all(
        connectionArgumentsRef.current.map(([, args]) =>
          client.readFromCache(documentNode, args, {}),
        ),
      )
        .map(Result.all)
        .flatMap((x) => x.toOption())
        .map((queries) =>
          queries.map((query) =>
            jsonPath.current.reduce(
              (acc, key) =>
                acc != null && typeof acc === "object" && key in acc
                  ? // @ts-expect-error indexable
                    acc[key]
                  : null,
              query,
            ),
          ),
        ) as Option<T[]>;
      if (!deepEqual(value, lastReturnedValueRef.current)) {
        lastReturnedValueRef.current = value;
        return value;
      } else {
        return lastReturnedValueRef.current;
      }
    }, [client, documentNode]);

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
