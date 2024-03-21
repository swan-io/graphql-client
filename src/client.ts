import {
  BadStatusError,
  EmptyResponseError,
  NetworkError,
  Request,
  TimeoutError,
  badStatusToError,
  emptyToError,
} from "@swan-io/request";
import { ClientCache } from "./cache/cache";
import { TypedDocumentNode } from "./types";
import { DocumentNode, GraphQLError, print } from "@0no-co/graphql.web";
import { getExecutableOperationName } from "./graphql/ast";
import { Future, Option, Result } from "@swan-io/boxed";
import { P, match } from "ts-pattern";
import { InvalidGraphQLResponseError, parseGraphQLError } from "./errors";
import { writeOperationToCache } from "./cache/write";
import { readOperationFromCache } from "./cache/read";

type RequestConfig = {
  url: string;
  headers: Record<string, string>;
  operationName: string;
  document: DocumentNode;
  variables: Record<string, any>;
};

export type MakeRequest = (
  config: RequestConfig
) => Future<
  Result<
    unknown,
    NetworkError | TimeoutError | BadStatusError | EmptyResponseError
  >
>;

export type ClientError =
  | NetworkError
  | TimeoutError
  | BadStatusError
  | EmptyResponseError
  | InvalidGraphQLResponseError
  | GraphQLError[];

export type ClientConfig = {
  url: string;
  headers?: Record<string, string>;
  makeRequest?: MakeRequest;
};

const defaultMakeRequest: MakeRequest = ({
  url,
  headers,
  operationName,
  document,
  variables,
}: RequestConfig) => {
  return Request.make({
    url: url,
    method: "POST",
    responseType: "json",
    headers: headers,
    body: JSON.stringify({
      operationName,
      query: print(document),
      variables,
    }),
  })
    .mapOkToResult(badStatusToError)
    .mapOkToResult(emptyToError);
};

export class Client {
  url: string;
  headers: Record<string, string>;
  cache: ClientCache;
  makeRequest: MakeRequest;
  subscribers: Set<() => void>;

  constructor(config: ClientConfig) {
    this.url = config.url;
    this.headers = config.headers ?? { "Content-Type": "application/json" };
    this.cache = new ClientCache();
    this.makeRequest = config.makeRequest ?? defaultMakeRequest;
    this.subscribers = new Set();
  }

  subscribe(func: () => void) {
    this.subscribers.add(func);
    return () => this.subscribers.delete(func);
  }

  request<Data, Variables>(
    document: TypedDocumentNode<Data, Variables>,
    variables: Variables
  ) {
    const operationName =
      getExecutableOperationName(document).getWithDefault("Untitled");

    const variablesAsRecord = (variables ?? {}) as Record<string, any>;

    return this.makeRequest({
      url: this.url,
      headers: this.headers,
      operationName,
      document,
      variables: variablesAsRecord,
    })
      .mapOkToResult((payload) =>
        match(payload)
          .returnType<
            Result<Data, GraphQLError[] | InvalidGraphQLResponseError>
          >()
          .with({ errors: P.select(P.array()) }, (errors) =>
            Result.Error(errors.map(parseGraphQLError))
          )
          .with({ data: P.select(P.not(P.nullish)) }, (data) =>
            Result.Ok(data as Data)
          )
          .otherwise((response) =>
            Result.Error(new InvalidGraphQLResponseError(response))
          )
      )
      .tapOk((data) => {
        writeOperationToCache(this.cache, document, data, variablesAsRecord);
        this.subscribers.forEach((func) => {
          func();
        });
      });
  }

  readFromCache<Data, Variables>(
    document: TypedDocumentNode<Data, Variables>,
    variables: Variables
  ) {
    const variablesAsRecord = (variables ?? {}) as Record<string, any>;

    return readOperationFromCache(
      this.cache,
      document,
      variablesAsRecord
    ) as Option<Data>;
  }

  query<Data, Variables>(
    document: TypedDocumentNode<Data, Variables>,
    variables: Variables
  ) {
    return this.request(document, variables);
  }

  commitMutation<Data, Variables>(
    document: TypedDocumentNode<Data, Variables>,
    variables: Variables
  ) {
    return this.request(document, variables);
  }
}
