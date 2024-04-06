import { DocumentNode, GraphQLError } from "@0no-co/graphql.web";
import { Future, Option, Result } from "@swan-io/boxed";
import { Request, badStatusToError, emptyToError } from "@swan-io/request";
import { P, match } from "ts-pattern";
import { ClientCache } from "./cache/cache";
import { optimizeQuery, readOperationFromCache } from "./cache/read";
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
import { Connection, Edge, TypedDocumentNode } from "./types";

export type RequestConfig = {
  url: string;
  headers: Record<string, string>;
  operationName: string;
  document: DocumentNode;
  variables: Record<string, unknown>;
};

export type MakeRequest = (
  config: RequestConfig,
) => Future<Result<unknown, ClientError>>;

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
    .mapOkToResult(emptyToError)
    .mapOkToResult((payload) =>
      match(payload as unknown)
        .returnType<
          Result<unknown, GraphQLError[] | InvalidGraphQLResponseError>
        >()
        .with({ errors: P.select(P.array()) }, (errors) =>
          Result.Error(errors.map(parseGraphQLError)),
        )
        .with({ data: P.select(P.nonNullable) }, (data) => Result.Ok(data))
        .otherwise((response) =>
          Result.Error(new InvalidGraphQLResponseError(response)),
        ),
    );
};

type ConnectionUpdate<Node> = [
  Connection<Node>,
  { prepend: Edge<Node>[] } | { append: Edge<Node>[] } | { remove: string[] },
];

const prepend = <A>(
  connection: Connection<A>,
  edges: Edge<A>[],
): ConnectionUpdate<A> => {
  return [connection, { prepend: edges }];
};

const append = <A>(
  connection: Connection<A>,
  edges: Edge<A>[],
): ConnectionUpdate<A> => {
  return [connection, { append: edges }];
};

const remove = <A>(
  connection: Connection<A>,
  ids: string[],
): ConnectionUpdate<A> => {
  return [connection, { remove: ids }];
};

export type GetConnectionUpdate<Data, Variables> = (config: {
  data: Data;
  variables: Variables;
  prepend: <A>(
    connection: Connection<A>,
    edges: Edge<A>[],
  ) => ConnectionUpdate<A>;
  append: <A>(
    connection: Connection<A>,
    edges: Edge<A>[],
  ) => ConnectionUpdate<A>;
  remove: <A>(connection: Connection<A>, ids: string[]) => ConnectionUpdate<A>;
}) => Option<ConnectionUpdate<unknown>>;

type RequestOptions<Data, Variables> = {
  optimize?: boolean;
  connectionUpdates?: GetConnectionUpdate<Data, Variables>[] | undefined;
};

export class Client {
  url: string;
  headers: Record<string, string>;
  cache: ClientCache;
  makeRequest: MakeRequest;

  subscribers: Set<() => void>;

  transformedDocuments: Map<DocumentNode, DocumentNode>;
  transformedDocumentsForRequest: Map<DocumentNode, DocumentNode>;

  constructor(config: ClientConfig) {
    this.url = config.url;
    this.headers = config.headers ?? { "Content-Type": "application/json" };
    this.cache = new ClientCache();
    this.makeRequest = config.makeRequest ?? defaultMakeRequest;
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
    {
      optimize = false,
      connectionUpdates,
    }: RequestOptions<Data, Variables> = {},
  ): Future<Result<Data, ClientError>> {
    const transformedDocument = this.getTransformedDocument(document);
    const transformedDocumentsForRequest =
      this.getTransformedDocumentsForRequest(document);

    const operationName =
      getExecutableOperationName(transformedDocument).getWithDefault(
        "Untitled",
      );

    const variablesAsRecord = variables as Record<string, unknown>;

    const possiblyOptimizedQuery = optimize
      ? optimizeQuery(this.cache, transformedDocument, variablesAsRecord).map(
          addTypenames,
        )
      : Option.Some(transformedDocumentsForRequest);

    if (possiblyOptimizedQuery.isNone()) {
      const operationResult = readOperationFromCache(
        this.cache,
        transformedDocument,
        variablesAsRecord,
      );
      if (operationResult.isSome()) {
        return Future.value(operationResult.get() as Result<Data, ClientError>);
      }
    }

    return this.makeRequest({
      url: this.url,
      headers: this.headers,
      operationName,
      document: possiblyOptimizedQuery.getWithDefault(
        transformedDocumentsForRequest,
      ),
      variables: variablesAsRecord,
    })
      .mapOk((data) => data as Data)
      .tapOk((data) => {
        writeOperationToCache(
          this.cache,
          transformedDocument,
          data,
          variablesAsRecord,
        );
      })
      .tapOk((data) => {
        if (connectionUpdates !== undefined) {
          connectionUpdates.forEach((getUpdate) => {
            getUpdate({ data, variables, prepend, append, remove }).map(
              ([connection, update]) => {
                this.cache.updateConnection(connection, update);
              },
            );
          });
        }
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
    requestOptions?: RequestOptions<Data, Variables>,
  ) {
    return this.request(document, variables, requestOptions);
  }

  commitMutation<Data, Variables>(
    document: TypedDocumentNode<Data, Variables>,
    variables: Variables,
    requestOptions?: RequestOptions<Data, Variables>,
  ) {
    return this.request(document, variables, requestOptions);
  }
}
