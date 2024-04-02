import { useState } from "react";
import { useQuery } from "../../src";
import { graphql } from "../gql";
import { FilmList } from "./FilmList";

const allFilmsQuery = graphql(`
  query allFilmsWithVariablesQuery($first: Int!, $after: String) {
    allFilms(first: $first, after: $after) {
      ...FilmsConnection
    }
  }
`);

export const App = () => {
  const [after, setAfter] = useState<string | null>(null);
  const [data, { isLoading }] = useQuery(allFilmsQuery, { first: 3, after });

  return (
    <div className="App">
      {data.match({
        NotAsked: () => null,
        Loading: () => <div>Loading ...</div>,
        Done: (result) =>
          result.match({
            Error: () => <div>An error occured</div>,
            Ok: ({ allFilms }) => {
              if (allFilms == null) {
                return <div>No films</div>;
              }
              return (
                <FilmList
                  films={allFilms}
                  onNextPage={setAfter}
                  isLoadingMore={isLoading}
                />
              );
            },
          }),
      })}
    </div>
  );
};
