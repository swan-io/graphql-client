import { AsyncData, Future, Result } from "@swan-io/boxed";
import { TypedDocumentNode } from "../types";
import { ClientError } from "../client";
import { useCallback, useContext, useState } from "react";
import { ClientContext } from "./ClientContext";
import { addTypenames, inlineFragments } from "../graphql/ast";

export type Mutation<Data, Variables> = readonly [
  (variables: Variables) => Future<Result<Data, ClientError>>,
  AsyncData<Result<Data, ClientError>>
];

export const useMutation = <Data, Variables>(
  mutation: TypedDocumentNode<Data, Variables>
): Mutation<Data, Variables> => {
  const [adaptedMutation] = useState<TypedDocumentNode<Data, Variables>>(() =>
    inlineFragments(addTypenames(mutation))
  );
  const client = useContext(ClientContext);

  const [data, setData] = useState<AsyncData<Result<Data, ClientError>>>(
    AsyncData.NotAsked()
  );

  const commitMutation = useCallback(
    (variables: Variables) => {
      setData(AsyncData.Loading());
      return client
        .commitMutation(adaptedMutation, variables)
        .tap((result) => setData(AsyncData.Done(result)));
    },
    [adaptedMutation]
  );

  return [commitMutation, data];
};
