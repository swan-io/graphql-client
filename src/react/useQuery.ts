import { AsyncData, Future, Result } from "@swan-io/boxed";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ClientError } from "../errors";
import { TypedDocumentNode } from "../types";
import { deepEqual } from "../utils";
import { ClientContext } from "./ClientContext";

export type QueryConfig = {
  suspense?: boolean;
  optimize?: boolean;
};

export type Query<Data, Variables> = readonly [
  AsyncData<Result<Data, ClientError>>,
  {
    isLoading: boolean;
    reload: () => Future<Result<Data, ClientError>>;
    refresh: () => Future<Result<Data, ClientError>>;
    setVariables: (variables: Partial<Variables>) => void;
  },
];

const usePreviousValue = <T>(value: T): T => {
  const previousRef = useRef(value);

  useEffect(() => {
    previousRef.current = value;
  }, [value]);

  return previousRef.current;
};

export const useQuery = <Data, Variables>(
  query: TypedDocumentNode<Data, Variables>,
  variables: Variables,
  { suspense = false, optimize = false }: QueryConfig = {},
): Query<Data, Variables> => {
  const client = useContext(ClientContext);

  // Query should never change
  const [stableQuery] = useState<TypedDocumentNode<Data, Variables>>(query);

  // Only break variables reference equality if not deeply equal
  const [stableVariables, setStableVariables] = useState<
    [Variables, Variables]
  >([variables, variables]);

  useEffect(() => {
    const [providedVariables] = stableVariables;
    if (!deepEqual(providedVariables, variables)) {
      setStableVariables([variables, variables]);
    }
  }, [stableVariables, variables]);

  // Get data from cache
  const getSnapshot = useCallback(() => {
    return client.readFromCache(stableQuery, stableVariables[1]);
  }, [client, stableQuery, stableVariables]);

  const data = useSyncExternalStore(
    (func) => client.subscribe(func),
    getSnapshot,
  );

  const asyncData = useMemo(() => {
    return data
      .map((value) => AsyncData.Done(value as Result<Data, ClientError>))
      .getWithDefault(AsyncData.Loading());
  }, [data]);

  const previousAsyncData = usePreviousValue(asyncData);

  const isSuspenseFirstFetch = useRef(true);

  useEffect(() => {
    if (suspense && isSuspenseFirstFetch.current) {
      isSuspenseFirstFetch.current = false;
      return;
    }
    const request = client.query(stableQuery, stableVariables[1], { optimize });
    return () => request.cancel();
  }, [client, suspense, optimize, stableQuery, stableVariables]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const refresh = useCallback(() => {
    setIsRefreshing(true);
    return client
      .request(stableQuery, stableVariables[1])
      .tap(() => setIsRefreshing(false));
  }, [client, stableQuery, stableVariables]);

  const [isReloading, setIsReloading] = useState(false);
  const reload = useCallback(() => {
    setIsReloading(true);
    setStableVariables(([stable]) => [stable, stable]);
    return client
      .request(stableQuery, stableVariables[0])
      .tap(() => setIsReloading(false));
  }, [client, stableQuery, stableVariables]);

  const isLoading = isRefreshing || isReloading || asyncData.isLoading();
  const asyncDataToExpose = isReloading
    ? AsyncData.Loading()
    : isLoading
      ? previousAsyncData
      : asyncData;

  if (suspense && asyncDataToExpose.isLoading()) {
    throw client
      .query(stableQuery, stableVariables[1], { optimize })
      .toPromise();
  }

  const setVariables = useCallback((variables: Partial<Variables>) => {
    setStableVariables((prev) => {
      const [prevStable, prevFinal] = prev;
      const nextFinal = { ...prevFinal, ...variables };
      if (!deepEqual(prevFinal, nextFinal)) {
        return [prevStable, nextFinal];
      } else {
        return prev;
      }
    });
  }, []);

  return [asyncDataToExpose, { isLoading, refresh, reload, setVariables }];
};
