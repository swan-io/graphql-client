---
title: Client
sidebar_label: Client
---

## Configuration

```ts
const client = new Client({
  url: "/path/to/gql",
});
```

### Params

- `url` (mandatory): the URL of your GraphQL API
- `schemaConfig` (mandatory): your [generated schema config](./getting-started/#2-generate-the-schema-config)
- `headers` (optional): the default headers to send
- `makeRequest` (optional): function that performs the request and returns a `Future<Result<unknown, ClientError>>` (e.g. to add request IDs, custom parsing of the payload, logging & custom error handling)

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
