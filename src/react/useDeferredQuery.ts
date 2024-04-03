import { AsyncData, Future, Option, Result } from "@swan-io/boxed";
import {
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { ClientError } from "../errors";
import { TypedDocumentNode } from "../types";
import { deepEqual } from "../utils";
import { ClientContext } from "./ClientContext";

export type DeferredQueryConfig = {
  optimize?: boolean;
};

export type DeferredQuery<Data, Variables> = readonly [
  AsyncData<Result<Data, ClientError>>,
  (variables: Variables) => Future<Result<Data, ClientError>>,
];

export const useDeferredQuery = <Data, Variables>(
  query: TypedDocumentNode<Data, Variables>,
  { optimize = false }: DeferredQueryConfig = {},
): DeferredQuery<Data, Variables> => {
  const client = useContext(ClientContext);

  // Query should never change
  const [stableQuery] = useState<TypedDocumentNode<Data, Variables>>(query);

  // Only break variables reference equality if not deeply equal
  const [stableVariables, setStableVariables] = useState<Option<Variables>>(
    Option.None(),
  );

  // Get data from cache
  const getSnapshot = useCallback(() => {
    return stableVariables.flatMap((variables) =>
      client.readFromCache(stableQuery, variables),
    );
  }, [client, stableQuery, stableVariables]);

  const data = useSyncExternalStore(
    (func) => client.subscribe(func),
    getSnapshot,
  );

  const asyncData = useMemo(() => {
    return data
      .map((value) => AsyncData.Done(value as Result<Data, ClientError>))
      .getWithDefault(AsyncData.NotAsked());
  }, [data]);

  const [isQuerying, setIsQuerying] = useState(false);
  const runQuery = useCallback(
    (variables: Variables) => {
      setStableVariables((stableVariables) =>
        stableVariables.match({
          None: () => Option.Some(variables),
          Some: (prevVariables) =>
            deepEqual(prevVariables, variables)
              ? stableVariables
              : Option.Some(variables),
        }),
      );
      setIsQuerying(true);
      return client
        .request(stableQuery, variables, { optimize })
        .tap(() => setIsQuerying(false));
    },
    [client, stableQuery, optimize],
  );

  const asyncDataToExpose = isQuerying ? AsyncData.Loading() : asyncData;

  return [asyncDataToExpose, runQuery];
};
