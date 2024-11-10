import { ASTNode, GraphQLError } from "@0no-co/graphql.web";
import {
  BadStatusError,
  EmptyResponseError,
  NetworkError,
  TimeoutError,
} from "@swan-io/request";

export type ClientError =
  | NetworkError
  | TimeoutError
  | BadStatusError
  | EmptyResponseError
  | InvalidGraphQLResponseError
  | GraphQLError[];

export class InvalidGraphQLResponseError extends Error {
  response: unknown;
  constructor(response: unknown) {
    super("Received an invalid GraphQL response");
    Object.setPrototypeOf(this, InvalidGraphQLResponseError.prototype);
    this.name = "InvalidGraphQLResponseError";
    this.response = response;
  }
}

export const parseGraphQLError = (error: unknown): GraphQLError => {
  if (
    typeof error === "object" &&
    error != null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    const graphqlError = error as Record<PropertyKey, unknown> & {
      message: string;
    };
    const originalError =
      "error" in error &&
      typeof error.error === "object" &&
      error.error != null &&
      "message" in error.error &&
      typeof error.error.message === "string"
        ? new Error(error.error.message)
        : undefined;
    return new GraphQLError(
      graphqlError.message,
      graphqlError.nodes as ReadonlyArray<ASTNode> | ASTNode | null | undefined,
      graphqlError.source,
      graphqlError.positions as readonly number[] | null | undefined,
      graphqlError.path as readonly (string | number)[] | null | undefined,
      originalError,
      graphqlError.extensions as
        | {
            [extension: string]: unknown;
          }
        | null
        | undefined,
    );
  }
  return new GraphQLError(JSON.stringify(error));
};

type Flat<T> = T extends (infer X)[] ? X : T;

export const ClientError = {
  toArray: <E extends Error | ClientError>(clientError: E): Flat<E>[] => {
    return Array.isArray(clientError)
      ? (clientError as Flat<E>[])
      : ([clientError] as Flat<E>[]);
  },
  forEach: <E extends Error | ClientError>(
    clientError: E,
    func: (error: Flat<E>, index?: number) => void,
  ) => {
    ClientError.toArray(clientError).forEach(func);
  },
};
