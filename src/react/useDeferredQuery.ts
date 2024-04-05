import { AsyncData, Deferred, Future, Option, Result } from "@swan-io/boxed";
import {
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ClientError } from "../errors";
import { TypedDocumentNode } from "../types";
import { deepEqual } from "../utils";
import { ClientContext } from "./ClientContext";

export type DeferredQueryConfig = {
  optimize?: boolean;
  debounce?: number;
};

export type DeferredQuery<Data, Variables> = readonly [
  AsyncData<Result<Data, ClientError>>,
  (variables: Variables) => Future<Result<Data, ClientError>>,
];

export const useDeferredQuery = <Data, Variables>(
  query: TypedDocumentNode<Data, Variables>,
  { optimize = false, debounce }: DeferredQueryConfig = {},
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
      return client
        .request(stableQuery, variables, { optimize })
        .tap(() => setIsQuerying(false));
    },
    [client, optimize, stableQuery],
  );

  const [isQuerying, setIsQuerying] = useState(false);
  const exposedRunQuery = useCallback(
    (variables: Variables) => {
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }
      setIsQuerying(true);
      if (debounce === undefined) {
        return runQuery(variables);
      } else {
        const [future, resolve] = Deferred.make<Result<Data, ClientError>>();
        timeoutRef.current = window.setTimeout(
          (variables: Variables) => {
            runQuery(variables).tap(resolve);
          },
          debounce,
          variables,
        );
        return future;
      }
    },
    [runQuery, debounce],
  );

  const asyncDataToExpose = isQuerying ? AsyncData.Loading() : asyncData;

  return [asyncDataToExpose, exposedRunQuery];
};
