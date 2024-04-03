---
title: useDeferredQuery
sidebar_label: useDeferredQuery
---

## useDeferredQuery(query, config?)

Similar to `useQuery`, but requires a manual call to `query`.

### Params

- `query`: your query document node
- `config` (optional)
  - `optimize`: adapt query to only require data that's missing from the cache (default: `false`)

### Returns

This hook returns a tuple you can extract like a `useState`:

```ts
const [data, query] = useDeferredQuery(...)
```

- `data` (`AsyncData<Result<Data, ClientError>>`): the GraphQL response
- `query(variables)`: runs the query

## Example

```ts
import { useDeferredQuery } from "@swan-io/graphql-client";
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
  const [user, queryUser] = useDeferredQuery(userPageQuery);

  useEffect(() => {
    queryUser({ userId })
  }, [userId, queryUser])

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
