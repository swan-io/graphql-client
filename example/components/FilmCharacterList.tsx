import { AsyncData, Result } from "@swan-io/boxed";
import { ReactNode } from "react";
import { ClientError } from "../../src";

type Connection =
  | {
      edges?:
        | ({
            node?: {
              id: string;
              name?: string | null;
            } | null;
          } | null)[]
        | null;
      pageInfo: {
        hasNextPage: boolean;
        endCursor?: string | null;
      };
    }
  | null
  | undefined;

type Props = {
  characters: AsyncData<Result<Connection, ClientError>>;
  onNextPage: (cursor: string | null) => void;
  isLoadingMore: boolean;
};

export const FilmCharacterList = ({
  characters,
  onNextPage,
  isLoadingMore,
}: Props) => {
  return characters.match<ReactNode>({
    NotAsked: () => null,
    Loading: () => "Loading",
    Done: (result) => {
      return result.match<ReactNode>({
        Error: () => "Error",
        Ok: (characters) => {
          if (characters.edges == null) {
            return null;
          }

          return (
            <>
              <ul>
                {characters.edges.map((edge) => {
                  if (edge == null) {
                    return null;
                  }
                  const node = edge.node;
                  if (node == null) {
                    return null;
                  }
                  return <li key={node.id}>{node.name}</li>;
                })}
              </ul>

              {isLoadingMore ? <div>Loading more</div> : null}

              {characters.pageInfo.hasNextPage ? (
                <button
                  onClick={() =>
                    onNextPage(characters.pageInfo.endCursor ?? null)
                  }
                  disabled={isLoadingMore}
                >
                  Load more
                </button>
              ) : null}
            </>
          );
        },
      });
    },
  });
};
