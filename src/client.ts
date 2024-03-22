import { DocumentNode, GraphQLError } from "@0no-co/graphql.web";
import { Future, Option, Result } from "@swan-io/boxed";
import {
  BadStatusError,
  EmptyResponseError,
  NetworkError,
  Request,
  TimeoutError,
  badStatusToError,
  emptyToError,
} from "@swan-io/request";
import { P, match } from "ts-pattern";
import { ClientCache } from "./cache/cache";
import { readOperationFromCache } from "./cache/read";
import { writeOperationToCache } from "./cache/write";
import {
  ClientError,
  InvalidGraphQLResponseError,
  parseGraphQLError,
} from "./errors";
import {
  addTypenames,
  getExecutableOperationName,
  inlineFragments,
} from "./graphql/ast";
import { print } from "./graphql/print";
import { TypedDocumentNode } from "./types";

type RequestConfig = {
  url: string;
  headers: Record<string, string>;
  operationName: string;
  document: DocumentNode;
  variables: Record<string, unknown>;
};

export type MakeRequest = (
  config: RequestConfig,
) => Future<
  Result<
    unknown,
    NetworkError | TimeoutError | BadStatusError | EmptyResponseError
  >
>;

export type ParseResponse = (payload: unknown) => Result<unknown, ClientError>;

export type ClientConfig = {
  url: string;
  headers?: Record<string, string>;
  makeRequest?: MakeRequest;
  parseResponse?: ParseResponse;
};

const defaultParseResponse = (payload: unknown) =>
  match(payload)
    .returnType<Result<unknown, GraphQLError[] | InvalidGraphQLResponseError>>()
    .with({ errors: P.select(P.array()) }, (errors) =>
      Result.Error(errors.map(parseGraphQLError)),
    )
    .with({ data: P.select(P.not(P.nullish)) }, (data) => Result.Ok(data))
    .otherwise((response) =>
      Result.Error(new InvalidGraphQLResponseError(response)),
    );

const defaultMakeRequest: MakeRequest = ({
  url,
  headers,
  operationName,
  document,
  variables,
}: RequestConfig) => {
  return Request.make({
    url,
    method: "POST",
    responseType: "json",
    headers,
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
  parseResponse: ParseResponse;

  subscribers: Set<() => void>;

  transformedDocuments: Map<DocumentNode, DocumentNode>;
  transformedDocumentsForRequest: Map<DocumentNode, DocumentNode>;

  constructor(config: ClientConfig) {
    this.url = config.url;
    this.headers = config.headers ?? { "Content-Type": "application/json" };
    this.cache = new ClientCache();
    this.makeRequest = config.makeRequest ?? defaultMakeRequest;
    this.parseResponse = config.parseResponse ?? defaultParseResponse;
    this.subscribers = new Set();
    this.transformedDocuments = new Map();
    this.transformedDocumentsForRequest = new Map();
  }

  getTransformedDocument(document: DocumentNode) {
    if (this.transformedDocuments.has(document)) {
      return this.transformedDocuments.get(document) as DocumentNode;
    } else {
      const transformedDocument = inlineFragments(addTypenames(document));
      this.transformedDocuments.set(document, transformedDocument);
      return transformedDocument;
    }
  }

  getTransformedDocumentsForRequest(document: DocumentNode) {
    if (this.transformedDocumentsForRequest.has(document)) {
      return this.transformedDocumentsForRequest.get(document) as DocumentNode;
    } else {
      const transformedDocument = addTypenames(document);
      this.transformedDocumentsForRequest.set(document, transformedDocument);
      return transformedDocument;
    }
  }

  subscribe(func: () => void) {
    this.subscribers.add(func);
    return () => this.subscribers.delete(func);
  }

  request<Data, Variables>(
    document: TypedDocumentNode<Data, Variables>,
    variables: Variables,
  ) {
    const transformedDocument = this.getTransformedDocument(document);
    const transformedDocumentsForRequest =
      this.getTransformedDocumentsForRequest(document);

    const operationName =
      getExecutableOperationName(transformedDocument).getWithDefault(
        "Untitled",
      );

    const variablesAsRecord = variables as Record<string, unknown>;

    // TODO:
    // optimizeQuery(
    //   this.cache,
    //   transformedDocument,
    //   variablesAsRecord,
    // )

    return this.makeRequest({
      url: this.url,
      headers: this.headers,
      operationName,
      document: transformedDocumentsForRequest,
      variables: variablesAsRecord,
    })
      .mapOkToResult(this.parseResponse)
      .mapOk((data) => data as Data)
      .tapOk((data) => {
        writeOperationToCache(
          this.cache,
          transformedDocument,
          data,
          variablesAsRecord,
        );
      })
      .tap((result) => {
        this.cache.setOperationInCache(
          transformedDocument,
          variablesAsRecord,
          result,
        );
        this.subscribers.forEach((func) => {
          func();
        });
      });
  }

  readFromCache<Data, Variables>(
    document: TypedDocumentNode<Data, Variables>,
    variables: Variables,
  ) {
    const variablesAsRecord = variables as Record<string, unknown>;
    const transformedDocument = this.getTransformedDocument(document);

    return match(
      this.cache.getOperationFromCache(transformedDocument, variablesAsRecord),
    )
      .with(Option.P.Some(Result.P.Error(P._)), (value) => value)
      .otherwise(() =>
        readOperationFromCache(
          this.cache,
          transformedDocument,
          variablesAsRecord,
        ),
      );
  }

  query<Data, Variables>(
    document: TypedDocumentNode<Data, Variables>,
    variables: Variables,
  ) {
    return this.request(document, variables);
  }

  commitMutation<Data, Variables>(
    document: TypedDocumentNode<Data, Variables>,
    variables: Variables,
  ) {
    return this.request(document, variables);
  }
}
