import { useState } from "react";
import { useQuery } from "../../src";
import { graphql } from "../gql";
import { FilmCharacterList } from "./FilmCharacterList";

export const FilmDetailsQuery = graphql(`
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
