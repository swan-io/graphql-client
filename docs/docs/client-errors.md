---
title: Client Errors
sidebar_label: Client Errors
---

## Errors

The default error handling is that any error (including `{"errors": [...]}` in your GraphQL response) makes the whole query in error. If you rather want the query to be considered valid, you can update the parsing logic by providing a custom `makeRequest` to your `Client`.

## Error types

- `NetworkError`: network isn't reachable
- `TimeoutError`: request timeout
- `BadStatusError`: request status is not in the valid range (`>= 200` && `< 300`)
- `EmptyResponseError`: response was empty
- `InvalidGraphQLResponseError`: error parsing the payload
- `GraphQLError[]`: the GraphQL payload returned errors
