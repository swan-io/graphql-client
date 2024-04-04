import { useRef } from "react";
import { match } from "ts-pattern";
import { isRecord } from "../utils";

export type Edge<T> = {
  cursor?: string | null;
  node?: T | null | undefined;
};

export type Connection<T> =
  | {
      edges?: (Edge<T> | null | undefined)[] | null | undefined;
      pageInfo: {
        hasPreviousPage?: boolean | null | undefined;
        hasNextPage?: boolean | null | undefined;
        endCursor?: string | null | undefined;
        startCursor?: string | null | undefined;
      };
    }
  | null
  | undefined;

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
    const connectionRef = useRef(connection);
    connectionRef.current = mergeConnection(
      connectionRef.current,
      connection,
      direction,
    );
    return connectionRef.current;
  };
};

export const useForwardPagination = createPaginationHook("after");

export const useBackwardPagination = createPaginationHook("before");
