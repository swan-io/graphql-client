---
title: Client
sidebar_label: Client
---

## Perform a query

```ts
client.query(query, variables).tap((result) => {
  console.log(result);
});
```

## Perform a mutation

```ts
client.commitMutation(mutation, variables).tap((result) => {
  console.log(result);
});
```
