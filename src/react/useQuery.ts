import { AsyncData, Deferred, Result } from "@swan-io/boxed";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ClientContext } from "./ClientContext";
import { TypedDocumentNode } from "../types";
import { deepEqual } from "../utils";
import { match } from "ts-pattern";
import { ClientError } from "../client";
import { addTypenames, inlineFragments } from "../graphql/ast";

export type UseQueryConfig = {
  suspense?: boolean;
  policy?: "no-cache" | "cache" | "cache-while-revalidate";
};

export type Query<Data> = readonly [
  AsyncData<Result<Data, ClientError>>,
  {
    nextData: AsyncData<Result<Data, ClientError>>;
    reload: () => void;
    refresh: () => void;
  }
];

export const useQuery = <Data, Variables>(
  query: TypedDocumentNode<Data, Variables>,
  variables: Variables,
  { suspense = false, policy = "cache-while-revalidate" }: UseQueryConfig = {}
): Query<Data> => {
  const [adaptedQuery] = useState<TypedDocumentNode<Data, Variables>>(() =>
    inlineFragments(addTypenames(query))
  );

  const client = useContext(ClientContext);

  const [stableVariables, setStableVariables] = useState(variables);
  const [isReloading, setIsReloading] = useState(false);

  const shouldQueryRef = useRef(true);

  const getSnapshot = useCallback(() => {
    return client.readFromCache(adaptedQuery, variables);
  }, [adaptedQuery, variables]);

  const dataFromCache = useSyncExternalStore(
    (func) => client.subscribe(func),
    getSnapshot
  );

  if (dataFromCache.isSome() && policy === "cache") {
    shouldQueryRef.current = false;
  }

  const isFirstRenderRef = useRef(true);
  const deferredRef = useRef(Deferred.make());
  const [future, resolve] = deferredRef.current;
  const promiseToThrow = useMemo(() => future.toPromise(), [future]);

  const [nextData, setNextData] = useState<
    AsyncData<Result<Data, ClientError>>
  >(AsyncData.NotAsked());

  useEffect(() => {
    isFirstRenderRef.current = false;
  }, []);

  useEffect(() => {
    if (!deepEqual(stableVariables, variables)) {
      setStableVariables(variables);
    }
  }, [variables]);

  const data = useMemo(() => {
    return dataFromCache
      .map((value) => AsyncData.Done(Result.Ok<Data, ClientError>(value)))
      .getWithDefault(nextData);
  }, [dataFromCache]);

  useEffect(() => {
    if (shouldQueryRef.current) {
      setNextData(AsyncData.Loading());
      const request = client
        .query(adaptedQuery, stableVariables)
        .tap((result) => {
          setNextData(AsyncData.Done(result));
          resolve(undefined);
        });
      return () => request.cancel();
    }
  }, [adaptedQuery, stableVariables]);

  const refresh = useCallback(() => {
    setNextData(AsyncData.Loading());
    client
      .request(adaptedQuery, stableVariables)
      .tap((result) => setNextData(AsyncData.Done(result)));
  }, [adaptedQuery, stableVariables]);

  const reload = useCallback(() => {
    setIsReloading(true);
    setNextData(AsyncData.Loading());
    client.request(adaptedQuery, stableVariables).tap((result) => {
      setNextData(AsyncData.Done(result));
      setIsReloading(false);
    });
  }, [adaptedQuery, stableVariables]);

  if (
    suspense &&
    isFirstRenderRef.current &&
    (dataFromCache.isNone() || policy == "no-cache")
  ) {
    throw promiseToThrow;
  }

  if (isReloading) {
    return [nextData, { nextData, refresh, reload }] as const;
  }

  const mostRelevantCachedData =
    (nextData.isDone() && nextData.get().isError()) ||
    (data.isNotAsked() && nextData.isLoading())
      ? nextData
      : data;

  return match(policy)
    .with("no-cache", () => {
      return [nextData, { nextData, refresh, reload }] as const;
    })
    .with("cache-while-revalidate", () => {
      return [mostRelevantCachedData, { nextData, refresh, reload }] as const;
    })
    .with("cache", () => {
      return [
        mostRelevantCachedData,
        {
          nextData,
          refresh,
          reload,
        },
      ] as const;
    })
    .exhaustive();
};
