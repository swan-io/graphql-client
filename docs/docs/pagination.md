---
title: Pagination
sidebar_label: Pagination
---

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
