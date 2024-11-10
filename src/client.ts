import { DocumentNode } from "@0no-co/graphql.web";
import { Future, Option, Result } from "@swan-io/boxed";
import { Request, badStatusToError, emptyToError } from "@swan-io/request";
import { ClientCache, SchemaConfig } from "./cache/cache";
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
  withCredentials?: boolean;
};

export type MakeRequest = (
  config: RequestConfig,
) => Future<Result<unknown, ClientError>>;

export type ClientConfig = {
  url: string;
  headers?: Record<string, string>;
  makeRequest?: MakeRequest;
  schemaConfig: SchemaConfig;
};

const defaultMakeRequest: MakeRequest = ({
  url,
  headers,
  operationName,
  withCredentials,
  document,
  variables,
}: RequestConfig) => {
  return Request.make({
    url,
    method: "POST",
    responseType: "json",
    headers,
    withCredentials: Option.fromNullable(withCredentials).getOr(false),
    body: JSON.stringify({
      operationName,
      query: print(document),
      variables,
    }),
  })
    .mapOkToResult(badStatusToError)
    .mapOkToResult(emptyToError)
    .mapOkToResult((payload) => {
      if (payload != null && typeof payload === "object") {
        if ("errors" in payload && Array.isArray(payload.errors)) {
          return Result.Error(payload.errors.map(parseGraphQLError));
        }
        if ("data" in payload && payload.data != null) {
          return Result.Ok(payload.data);
        }
      }
      return Result.Error(new InvalidGraphQLResponseError(payload));
    });
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

export type RequestOverrides = Partial<
  Pick<RequestConfig, "url" | "headers" | "withCredentials">
>;

type RequestOptions<Data, Variables> = {
  optimize?: boolean;
  normalize?: boolean;
  connectionUpdates?: GetConnectionUpdate<Data, Variables>[] | undefined;
  overrides?: RequestOverrides | undefined;
};

export class Client {
  url: string;
  headers: Record<string, string>;
  cache: ClientCache;
  schemaConfig: SchemaConfig;
  makeRequest: MakeRequest;

  subscribers: Set<() => void>;

  transformedDocuments: Map<DocumentNode, DocumentNode>;
  transformedDocumentsForRequest: Map<DocumentNode, DocumentNode>;

  constructor(config: ClientConfig) {
    this.url = config.url;
    this.headers = config.headers ?? { "Content-Type": "application/json" };
    this.schemaConfig = config.schemaConfig;
    this.cache = new ClientCache(config.schemaConfig);
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
    variables: NoInfer<Variables>,
    {
      optimize = false,
      normalize = true,
      connectionUpdates,
      overrides,
    }: RequestOptions<Data, Variables> = {},
  ): Future<Result<Data, ClientError>> {
    const transformedDocument = this.getTransformedDocument(document);
    const transformedDocumentsForRequest =
      this.getTransformedDocumentsForRequest(document);

    const operationName =
      getExecutableOperationName(transformedDocument).getOr("Untitled");

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
      operationName,
      document: possiblyOptimizedQuery.getOr(transformedDocumentsForRequest),
      variables: variablesAsRecord,
      ...overrides,
      headers: {
        ...this.headers,
        ...(overrides != null ? overrides.headers : null),
      },
    })
      .mapOk((data) => data as Data)
      .tapOk((data) => {
        if (normalize) {
          writeOperationToCache(
            this.cache,
            transformedDocument,
            data,
            variablesAsRecord,
          );
        }
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
    variables: NoInfer<Variables>,
    { normalize = true }: { normalize?: boolean },
  ) {
    const variablesAsRecord = variables as Record<string, unknown>;
    const transformedDocument = this.getTransformedDocument(document);
    const cached = this.cache.getOperationFromCache(
      transformedDocument,
      variablesAsRecord,
    );

    if (cached.isSome() && cached.get().isError()) {
      return cached;
    }
    if (cached.isSome() && cached.get().isOk() && normalize === false) {
      return cached;
    }
    return readOperationFromCache(
      this.cache,
      transformedDocument,
      variablesAsRecord,
    );
  }

  query<Data, Variables>(
    document: TypedDocumentNode<Data, Variables>,
    variables: NoInfer<Variables>,
    requestOptions?: RequestOptions<Data, Variables>,
  ) {
    return this.request(document, variables, requestOptions);
  }

  commitMutation<Data, Variables>(
    document: TypedDocumentNode<Data, Variables>,
    variables: NoInfer<Variables>,
    requestOptions?: RequestOptions<Data, Variables>,
  ) {
    return this.request(document, variables, requestOptions);
  }

  purge() {
    this.cache = new ClientCache(this.schemaConfig);
    this.subscribers.forEach((func) => {
      func();
    });
  }
}
