import { AsyncData, Future, Result } from "@swan-io/boxed";
import { useCallback, useContext, useRef, useState } from "react";
import { GetConnectionUpdate, RequestOverrides } from "../client";
import { ClientError } from "../errors";
import { TypedDocumentNode } from "../types";
import { ClientContext } from "./ClientContext";

export type MutationExtraConfig = { overrides?: RequestOverrides };

export type Mutation<Data, Variables> = readonly [
  (
    variables: Variables,
    config?: MutationExtraConfig,
  ) => Future<Result<Data, ClientError>>,
  AsyncData<Result<Data, ClientError>>,
];

export type MutationConfig<Data, Variables> = {
  connectionUpdates?: GetConnectionUpdate<Data, Variables>[] | undefined;
};

export const useMutation = <Data, Variables>(
  mutation: TypedDocumentNode<Data, Variables>,
  config: MutationConfig<Data, Variables> = {},
): Mutation<Data, Variables> => {
  const client = useContext(ClientContext);

  const connectionUpdatesRef = useRef(config?.connectionUpdates);
  connectionUpdatesRef.current = config?.connectionUpdates;

  const [stableMutation] =
    useState<TypedDocumentNode<Data, Variables>>(mutation);

  const [data, setData] = useState<AsyncData<Result<Data, ClientError>>>(
    AsyncData.NotAsked(),
  );

  const commitMutation = useCallback(
    (variables: Variables, { overrides }: MutationExtraConfig = {}) => {
      setData(AsyncData.Loading());
      return client
        .commitMutation(stableMutation, variables, {
          connectionUpdates: connectionUpdatesRef.current,
          overrides,
        })
        .tap((result) => setData(AsyncData.Done(result)));
    },
    [client, stableMutation],
  );

  return [commitMutation, data];
};
