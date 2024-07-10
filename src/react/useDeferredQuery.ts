import { AsyncData, Deferred, Future, Option, Result } from "@swan-io/boxed";
import {
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { RequestOverrides } from "../client";
import { ClientError } from "../errors";
import { TypedDocumentNode } from "../types";
import { deepEqual } from "../utils";
import { ClientContext } from "./ClientContext";

export type DeferredQueryConfig = {
  optimize?: boolean;
  normalize?: boolean;
  debounce?: number;
};

export type DeferredQueryExtraConfig = { overrides?: RequestOverrides };

export type DeferredQuery<Data, Variables> = readonly [
  AsyncData<Result<Data, ClientError>>,
  {
    query: (
      variables: Variables,
      config?: DeferredQueryExtraConfig,
    ) => Future<Result<Data, ClientError>>;
    reset: () => void;
  },
];

export const useDeferredQuery = <Data, Variables>(
  query: TypedDocumentNode<Data, Variables>,
  { optimize = false, normalize = true, debounce }: DeferredQueryConfig = {},
): DeferredQuery<Data, Variables> => {
  const client = useContext(ClientContext);

  // Query should never change
  const [stableQuery] = useState<TypedDocumentNode<Data, Variables>>(query);

  // Only break variables reference equality if not deeply equal
  const [stableVariables, setStableVariables] = useState<Option<Variables>>(
    Option.None(),
  );

  const timeoutRef = useRef<number | undefined>(undefined);

  // Get data from cache
  const getSnapshot = useCallback(() => {
    return stableVariables.flatMap((variables) =>
      client.readFromCache(stableQuery, variables, { normalize }),
    );
  }, [client, stableQuery, stableVariables, normalize]);

  const data = useSyncExternalStore(
    (func) => client.subscribe(func),
    getSnapshot,
  );

  const asyncData = useMemo(() => {
    return data
      .map((value) => AsyncData.Done(value as Result<Data, ClientError>))
      .getOr(AsyncData.NotAsked());
  }, [data]);

  const runQuery = useCallback(
    (variables: Variables, { overrides }: DeferredQueryExtraConfig = {}) => {
      setStableVariables((stableVariables) =>
        stableVariables.match({
          None: () => Option.Some(variables),
          Some: (prevVariables) =>
            deepEqual(prevVariables, variables)
              ? stableVariables
              : Option.Some(variables),
        }),
      );
      return client
        .request(stableQuery, variables, { optimize, overrides })
        .tap(() => setIsQuerying(false));
    },
    [client, optimize, stableQuery],
  );

  const [isQuerying, setIsQuerying] = useState(false);
  const exposedRunQuery = useCallback(
    (variables: Variables, config?: DeferredQueryExtraConfig) => {
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }
      setIsQuerying(true);
      if (debounce === undefined) {
        return runQuery(variables, config);
      } else {
        const [future, resolve] = Deferred.make<Result<Data, ClientError>>();
        timeoutRef.current = window.setTimeout(
          (variables: Variables) => {
            runQuery(variables, config).tap(resolve);
          },
          debounce,
          variables,
        );
        return future;
      }
    },
    [runQuery, debounce],
  );

  const reset = useCallback(() => {
    setIsQuerying(false);
    setStableVariables(Option.None());
  }, []);

  const asyncDataToExpose = isQuerying ? AsyncData.Loading() : asyncData;

  return [asyncDataToExpose, { query: exposedRunQuery, reset }];
};
