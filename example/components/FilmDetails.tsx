import { useState } from "react";
import { useDeferredQuery, useQuery } from "../../src";
import { graphql } from "../gql";
import { FilmCharacterList } from "./FilmCharacterList";

const FilmDetailsQuery = graphql(`
  query FilmDetails($filmId: ID!, $first: Int!, $after: String) {
    film(id: $filmId) {
      id
      title
      director
      openingCrawl
      characterConnection(first: $first, after: $after) {
        ...FilmCharactersConnection
      }
      releaseDate
    }
  }
`);

const ProducersQuery = graphql(`
  query Producers($filmId: ID!) {
    film(id: $filmId) {
      id
      producers
    }
  }
`);

type Props = {
  filmId: string;
  optimize: boolean;
};

export const FilmDetails = ({ filmId, optimize }: Props) => {
  const [after, setAfter] = useState<string | null>(null);
  const [data, { isLoading }] = useQuery(
    FilmDetailsQuery,
    {
      filmId,
      first: 5,
      after,
    },
    { optimize },
  );

  const [producers, queryProducers] = useDeferredQuery(ProducersQuery);

  return (
    <div className="FilmDetails" style={{ opacity: isLoading ? 0.5 : 1 }}>
      {data.match({
        NotAsked: () => null,
        Loading: () => <div>Loading ...</div>,
        Done: (result) =>
          result.match({
            Error: () => <div>An error occured</div>,
            Ok: ({ film }) => {
              if (film == null) {
                return <div>No film</div>;
              }
              return (
                <>
                  <h1>{film.title}</h1>
                  <div>Director: {film.director}</div>
                  <div>Release date: {film.releaseDate}</div>
                  <div>
                    Producers:{" "}
                    {producers.match({
                      NotAsked: () => (
                        <span
                          style={{
                            textDecoration: "underline",
                            cursor: "pointer",
                          }}
                          onClick={() => queryProducers({ filmId })}
                        >
                          Load
                        </span>
                      ),
                      Loading: () => <span>Loading ...</span>,
                      Done: (result) =>
                        result.match({
                          Error: () => <span>Error</span>,
                          Ok: ({ film }) => (
                            <span>{film?.producers?.join(", ")}</span>
                          ),
                        }),
                    })}
                  </div>
                  <div>
                    Opening crawl:
                    <pre>{film.openingCrawl}</pre>
                  </div>
                  {film.characterConnection != null ? (
                    <>
                      <h2>Characters</h2>
                      <FilmCharacterList
                        characters={film.characterConnection}
                        onNextPage={setAfter}
                        isLoadingMore={isLoading}
                      />
                    </>
                  ) : null}
                </>
              );
            },
          }),
      })}
    </div>
  );
};
