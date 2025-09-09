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
import { RequestOverrides } from "../client";
import { ClientError } from "../errors";
import { TypedDocumentNode } from "../types";
import { deepEqual } from "../utils";
import { ClientContext } from "./ClientContext";

export type QueryConfig = {
  suspense?: boolean;
  optimize?: boolean;
  normalize?: boolean;
  overrides?: RequestOverrides;
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

const usePreviousValue = <A, T extends AsyncData<A>>(value: T): T => {
  const previousRef = useRef(value);

  useEffect(() => {
    if (value.isDone()) {
      previousRef.current = value;
    }
    if (value.isLoading() && previousRef.current.isNotAsked()) {
      previousRef.current = value;
    }
  }, [value]);

  return previousRef.current;
};

export const useQuery = <Data, Variables>(
  query: TypedDocumentNode<Data, Variables>,
  variables: NoInfer<Variables>,
  {
    suspense = false,
    optimize = false,
    normalize = true,
    overrides,
  }: QueryConfig = {},
): Query<Data, Variables> => {
  const client = useContext(ClientContext);

  // Query should never change
  const [stableQuery] = useState<TypedDocumentNode<Data, Variables>>(query);

  // Only break variables reference equality if not deeply equal
  const [stableVariables, setStableVariables] = useState<
    [Variables, Variables]
  >([variables, variables]);

  // Only break overrides reference equality if not deeply equal
  const [stableOverrides, setStableOverrides] = useState<
    RequestOverrides | undefined
  >(overrides);

  useEffect(() => {
    const [providedVariables] = stableVariables;
    if (!deepEqual(providedVariables, variables)) {
      setIsReloading(true);
      setStableVariables([variables, variables]);
    }
  }, [stableVariables, variables]);

  useEffect(() => {
    if (!deepEqual(stableOverrides, overrides)) {
      setIsReloading(true);
      setStableOverrides(overrides);
    }
  }, [stableOverrides, overrides]);

  // Get data from cache
  const getSnapshot = useCallback(() => {
    return client.readFromCache(stableQuery, stableVariables[1], { normalize });
  }, [client, stableQuery, stableVariables, normalize]);

  const data = useSyncExternalStore(
    (func) => client.subscribe(func),
    getSnapshot,
  );

  const asyncData = useMemo(() => {
    return data
      .map((value) => AsyncData.Done(value as Result<Data, ClientError>))
      .getOr(AsyncData.Loading());
  }, [data]);

  const previousAsyncData = usePreviousValue(asyncData);

  const isSuspenseFirstFetch = useRef(true);
  const isReloadingManually = useRef(false);

  useEffect(() => {
    if (suspense && isSuspenseFirstFetch.current) {
      isSuspenseFirstFetch.current = false;
      return;
    }
    if (isReloadingManually.current) {
      return;
    }
    const request = client
      .query(stableQuery, stableVariables[1], {
        optimize,
        overrides: stableOverrides,
        normalize,
      })
      .tap(() => setIsReloading(false));
    return () => request.cancel();
  }, [
    client,
    suspense,
    optimize,
    normalize,
    stableOverrides,
    stableQuery,
    stableVariables,
  ]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const refresh = useCallback(() => {
    setIsRefreshing(true);
    return client
      .query(stableQuery, stableVariables[1], {
        overrides: stableOverrides,
        normalize,
      })
      .tap(() => setIsRefreshing(false));
  }, [client, stableQuery, stableOverrides, stableVariables, normalize]);

  const [isReloading, setIsReloading] = useState(false);
  const reload = useCallback(() => {
    setIsReloading(true);
    setStableVariables(([stable]) => [stable, stable]);
    isReloadingManually.current = true;
    return client
      .query(stableQuery, stableVariables[0], {
        overrides: stableOverrides,
        normalize,
      })
      .tap(() => {
        setIsReloading(false);
        isReloadingManually.current = false;
      });
  }, [client, stableQuery, stableOverrides, stableVariables, normalize]);

  const isLoading = isRefreshing || isReloading || asyncData.isLoading();
  const asyncDataToExpose = isReloading
    ? AsyncData.Loading()
    : isLoading
      ? previousAsyncData
      : asyncData;

  if (
    suspense &&
    isSuspenseFirstFetch.current &&
    asyncDataToExpose.isLoading()
  ) {
    throw client
      .query(stableQuery, stableVariables[1], { optimize, normalize })
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
