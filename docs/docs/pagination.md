---
title: Pagination
sidebar_label: Pagination
---

As far as the client is concerned, a paginated query is a different query (as it has different variables). This is why we use React hooks to perform the pagination aggregate using some metadata added when the query is received.

## Setting the cursor

The the `setVariables` function from `useQuery` to indicate that the update shouldn't be a full query reload.

```ts
const [data, {setVariables}] = useQuery(..., {})

setVariables({after: cursor})
```

## useForwardPagination(connection)

Aggregates the connection data (with `after`).

```ts
const users = useForwardPagination(usersConnection);
```

## useBackwardPagination(connection)

Aggregates the connection data (with `before`).

```ts
const users = useBackwardPagination(usersConnection);
```
