import { useForwardPagination } from "../../src";
import { FragmentType, graphql, useFragment } from "../gql";

export const FilmCharactersConnectionFragment = graphql(`
  fragment FilmCharactersConnection on FilmCharactersConnection {
    edges {
      node {
        id
        name
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
`);

type Props = {
  characters: FragmentType<typeof FilmCharactersConnectionFragment>;
  onNextPage: (cursor: string | null) => void;
  isLoadingMore: boolean;
};

export const FilmCharacterList = ({
  characters,
  onNextPage,
  isLoadingMore,
}: Props) => {
  const connection = useForwardPagination(
    useFragment(FilmCharactersConnectionFragment, characters),
  );

  if (connection.edges == null) {
    return null;
  }

  return (
    <>
      <ul>
        {connection.edges.map((edge) => {
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

      {connection.pageInfo.hasNextPage ? (
        <button
          onClick={() => onNextPage(connection.pageInfo.endCursor ?? null)}
          disabled={isLoadingMore}
        >
          Load more
        </button>
      ) : null}
    </>
  );
};
