---
title: useQuery
sidebar_label: useQuery
---

## useQuery(query, variables, config?)

### Params

- `query`: your query document node
- `variables`: your query variables
- `config` (optional)
  - `suspense`: use React Suspense (default: `false`)
  - `optimize`: adapt query to only require data that's missing from the cache (default: `false`)

### Returns

This hook returns a tuple you can extract like a `useState`:

```ts
const [data, {isLoading, refresh, reload}] = useQuery(...)
```

- `data` (`AsyncData<Result<Data, ClientError>>`): the GraphQL response
- `isLoading` (`boolean`): if the query is fetching
- `refresh()`: refresh the query in the background, keeping current data on screen
- `reload()`: reload the query (full reload, showing a full loading state)

## Example

```ts
import { useQuery } from "@swan-io/graphql-client";
// ...

const userPageQuery = graphql(`
  query UserPage($userId: ID!) {
    user(id: $userId) {
      id
      username
      avatar
    }
  }
`);

type Props = {
  userId: string;
};

const UserPage = ({ userId }: Props) => {
  const [user] = useQuery(userPageQuery, { userId });

  return user.match({
    NotAsked: () => null,
    Loading: () => <LoadingIndicator />,
    Done: (result) =>
      result.match({
        Error: (error) => <ErrorIndicator error={error} />,
        Ok: (user) => <UserDetails user={user} />,
      }),
  });
};
```
