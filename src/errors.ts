import { ASTNode, GraphQLError } from "@0no-co/graphql.web";
import {
  BadStatusError,
  EmptyResponseError,
  NetworkError,
  TimeoutError,
} from "@swan-io/request";
import { P, match } from "ts-pattern";

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
    super(`Received an invalid GraphQL response`);
    this.response = response;
  }
}

export const parseGraphQLError = (error: unknown): GraphQLError => {
  return match(error)
    .with(
      {
        message: P.string,
        nodes: P.optional(P.any),
        source: P.optional(P.any),
        positions: P.optional(P.any),
        path: P.optional(P.any),
        error: P.optional(P.any),
        extensions: P.optional(P.any),
      },
      ({ message, nodes, source, positions, path, error, extensions }) => {
        const originalError = match(error)
          .with({ message: P.string }, ({ message }) => new Error(message))
          .otherwise(() => undefined);
        return new GraphQLError(
          message,
          nodes as ReadonlyArray<ASTNode> | ASTNode | null | undefined,
          source,
          positions as readonly number[] | null | undefined,
          path as readonly (string | number)[] | null | undefined,
          originalError,
          extensions as
            | {
                [extension: string]: unknown;
              }
            | null
            | undefined,
        );
      },
    )
    .otherwise((error) => new GraphQLError(JSON.stringify(error)));
};

export const ClientError = {
  toArray: (clientError: ClientError) => {
    return Array.isArray(clientError) ? clientError : [clientError];
  },
  forEach: (
    clientError: ClientError,
    func: (
      error:
        | NetworkError
        | TimeoutError
        | BadStatusError
        | EmptyResponseError
        | InvalidGraphQLResponseError
        | GraphQLError,
      index?: number,
    ) => void,
  ) => {
    ClientError.toArray(clientError).forEach(func);
  },
};
