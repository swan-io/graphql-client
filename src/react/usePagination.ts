import { AsyncData, Result } from "@swan-io/boxed";
import { useEffect, useRef, useState } from "react";
import { match } from "ts-pattern";
import { isRecord } from "../utils";

type Edge<T> = {
  cursor?: string | null;
  node: T;
};

type Connection<T> = {
  edges: Edge<T>[];
  pageInfo: {
    hasPreviousPage?: boolean | null;
    hasNextPage?: boolean | null;
    endCursor?: string | null;
    startCursor?: string | null;
  };
};

type mode = "before" | "after";

const mergeConnection = <A, T extends Connection<A>>(
  previous: T,
  next: T,
  mode: mode
): T => {
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
    edges: match(mode)
      .with("before", () => [...next.edges, ...previous.edges])
      .with("after", () => [...previous.edges, ...next.edges])
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
    const connectionRef = useRef(connection);
    connectionRef.current = mergeConnection(
      connectionRef.current,
      connection,
      direction
    );
    return connectionRef.current;
  };
};

export const useForwardPagination = createPaginationHook("after");

export const useBackwardPagination = createPaginationHook("before");
