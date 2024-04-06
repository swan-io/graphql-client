import { DocumentNode } from "@0no-co/graphql.web";

export interface DocumentTypeDecoration<TResult, TVariables> {
  /**
   * This type is used to ensure that the variables you pass in to the query are assignable to Variables
   * and that the Result is assignable to whatever you pass your result to. The method is never actually
   * implemented, but the type is valid because we list it as optional
   */
  __apiType?: (variables: TVariables) => TResult;
}

export interface TypedDocumentNode<
  TResult = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  },
  TVariables = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  },
> extends DocumentNode,
    DocumentTypeDecoration<TResult, TVariables> {}

export type Edge<T> = {
  __typename?: string;
  cursor?: string | null;
  node?: T | null | undefined;
};

export type Connection<T> =
  | {
      edges?: (Edge<T> | null | undefined)[] | null | undefined;
      pageInfo: {
        hasPreviousPage?: boolean | null | undefined;
        hasNextPage?: boolean | null | undefined;
        endCursor?: string | null | undefined;
        startCursor?: string | null | undefined;
      };
    }
  | null
  | undefined;
