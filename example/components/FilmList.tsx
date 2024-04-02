import { useForwardPagination } from "../../src";
import { FragmentType, graphql, useFragment } from "../gql";
import { Film } from "./Film";

export const FilmsConnectionFragment = graphql(`
  fragment FilmsConnection on FilmsConnection {
    edges {
      node {
        id
        ...FilmItem
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
`);

type Props = {
  films: FragmentType<typeof FilmsConnectionFragment>;
  onNextPage: (cursor: string | null) => void;
  isLoadingMore: boolean;
};

export const FilmList = ({ films, onNextPage, isLoadingMore }: Props) => {
  const connection = useForwardPagination(
    useFragment(FilmsConnectionFragment, films),
  );

  if (connection.edges == null) {
    return null;
  }

  return (
    <>
      {connection.edges.map((edge) => {
        if (edge == null) {
          return null;
        }
        const node = edge.node;
        if (node == null) {
          return null;
        }
        return <Film film={node} key={node.id} />;
      })}

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
