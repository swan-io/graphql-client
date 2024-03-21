import { AsyncData, Result } from "@swan-io/boxed";
import { useEffect, useState } from "react";
import { match } from "ts-pattern";

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
  return <
    A,
    T extends Connection<A> | AsyncData<Result<Connection<A>, unknown>>
  >(
    connection: T
  ): T => {
    const [aggregate, setAggregate] = useState(connection);

    useEffect(() => {
      if (
        AsyncData.isAsyncData(connection) &&
        AsyncData.isAsyncData(aggregate) &&
        connection.isDone() &&
        aggregate.isDone()
      ) {
        const connectionResult = connection.get();
        const aggregateResult = aggregate.get();
        if (connectionResult.isOk() && aggregateResult.isOk()) {
          const connectionValue = connectionResult.get();
          if (connectionValue != undefined) {
            setAggregate(
              mergeConnection(
                aggregateResult.get(),
                connectionValue,
                direction
              ) as T
            );
          }
        }
      } else {
        if (connection != undefined) {
          setAggregate(
            mergeConnection(
              aggregate as Connection<A>,
              connection as Connection<A>,
              direction
            ) as T
          );
        }
      }
    }, [connection]);

    return aggregate;
  };
};

export const useAfterPagination = createPaginationHook("after");

export const useBeforePagination = createPaginationHook("before");
