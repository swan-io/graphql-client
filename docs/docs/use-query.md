---
title: useQuery
sidebar_label: useQuery
---

## useQuery(query, variables, config?)

The `useQuery` hook will execute the query with the given `variables`.

```ts
import { AsyncData, Result } from "@swan-io/boxed";
import { useQuery } from "@swan-io/graphql-client";
import { match, P } from "ts-pattern";

const query = gql(`
  query MyQuery {
    __typename
  }
`)

const MyComponent = () => {
  const [data] = useQuery(query, {});

  return match(data)
    .with(AsyncData.P.NotAsked, AsyncData.P.Loading, () => <LoadingView />)
    .with(AsyncData.P.Done(Result.P.Error(P.select())), (error) => <ErrorView error={error} />)
    .with(AsyncData.P.Done(Result.P.Ok(P.select())), data => {
      // show your data
    })
    .exhaustive();
}
```

`data` is exposed as an [`AsyncData`](https://swan-io.github.io/boxed/async-data) (to represent the loading date), that contains a [`Result`](https://swan-io.github.io/boxed/result) (to represent the success of the operation), which is either `Ok<Data>` or `Error<ClientError>`.

This structure avoids any ambuguity as to what the current state of the data is.

### Params

- `query`: your query document node
- `variables`: your query variables
- `config` (optional)
  - `suspense`: use React Suspense (default: `false`)
  - `overrides`: custom request configuration (`url`, `headers` and/or `withCredentials`)
  - `optimize`: (⚠️ experimental) adapt query to only require data that's missing from the cache (default: `false`)

### Returns

This hook returns a tuple you can extract like a `useState`:

```ts
const [data, {isLoading, refresh, reload, setVariables}] = useQuery(...)
```

- `data` (`AsyncData<Result<Data, ClientError>>`): the GraphQL response
- `isLoading` (`boolean`): if the query is fetching
- `refresh()`: refresh the query in the background, keeping current data on screen
- `reload()`: reload the query (full reload, showing a full loading state and resets local variables)
- `setVariables(variables)`: overwrites the variables locally, useful for `before` & `after` pagination

### Lifecycle

Any time the provided `variables` structurally change (meaning they're not deeply equal to the previous ones), the query will fully reload.

### Suspense

You can optionally provide a `suspense` flag to activate the feature, but the exposed `data` will still be an `AsyncData<Result<Data, ClientError>>` so that your component isn't tied to a particular rendering context: it'll always be capable of handling its own loading state if not suspended.

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
