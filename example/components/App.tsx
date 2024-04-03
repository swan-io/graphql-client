import { Option } from "@swan-io/boxed";
import { useState } from "react";
import { useQuery } from "../../src";
import { graphql } from "../gql";
import { FilmDetails } from "./FilmDetails";
import { FilmList } from "./FilmList";

const AllFilmsQuery = graphql(`
  query allFilmsWithVariablesQuery($first: Int!, $after: String) {
    allFilms(first: $first, after: $after) {
      ...FilmsConnection
    }
  }
`);

export const App = () => {
  const [optimize, setOptimize] = useState(false);
  const [after, setAfter] = useState<string | null>(null);
  const [activeFilm, setActiveFilm] = useState<Option<string>>(Option.None());

  const [data, { isLoading }] = useQuery(
    AllFilmsQuery,
    { first: 3, after },
    { optimize },
  );

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
                <div className="Main">
                  <div className="Sidebar">
                    <label>
                      <input
                        type="checkbox"
                        checked={optimize}
                        onChange={() => setOptimize((x) => !x)}
                      />
                      Optimize
                    </label>
                    <FilmList
                      films={allFilms}
                      onNextPage={setAfter}
                      isLoadingMore={isLoading}
                      activeFilm={activeFilm}
                      onPressFilm={(filmId: string) =>
                        setActiveFilm(Option.Some(filmId))
                      }
                    />
                  </div>
                  <div className="Contents">
                    {activeFilm.match({
                      None: () => <div>No film selected</div>,
                      Some: (filmId) => (
                        <FilmDetails
                          filmId={filmId}
                          key={filmId}
                          optimize={optimize}
                        />
                      ),
                    })}
                  </div>
                </div>
              );
            },
          }),
      })}
    </div>
  );
};
