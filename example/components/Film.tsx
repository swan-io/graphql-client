import { FragmentType, graphql, useFragment } from "../gql";

const FilmFragment = graphql(`
  fragment FilmItem on Film {
    id
    title
    releaseDate
    producers
  }
`);

type Props = {
  film: FragmentType<typeof FilmFragment>;
  isActive: boolean;
  onPress: (filmId: string) => void;
};

export const Film = ({ film: data, isActive, onPress }: Props) => {
  const film = useFragment(FilmFragment, data);
  return (
    <div
      className="Film"
      data-active={isActive}
      onClick={() => onPress(film.id)}
    >
      <h3>{film.title}</h3>
      <p>{film.releaseDate}</p>
    </div>
  );
};
