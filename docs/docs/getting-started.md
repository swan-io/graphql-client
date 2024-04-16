---
title: Getting started
sidebar_label: Getting started
---

# Getting started

**GraphQL Client** is a simple GraphQL client for React applications. It's focused on giving a good, typesafe experience when working on your codebase.

## 1. Install

```console
$ yarn add @swan-io/graphql-client
```

or

```console
$ npm install @swan-io/graphql-client
```

## 2. Generate the schema config

The schema config is necessary for the cache to understand when your spread an interface type (e.g. `on ... Node { id }`). Don't worry, this ends up being really light and wont't affect your bundle size much.

```console
$ generate-schema-config path/to/schema.gql dist/schema-config.json
```

## 2. Create your client

Configure your client with your `url`, desired default `headers` & the `schemaConfig` you just generateed.

```ts title="src/index.tsx"
import { Client, ClientContext } from "@swan-io/graphql-client";
import { App } from "./App";
import { createRoot } from "react-dom/client";
import schemaConfig from "./dist/schema-config.json"

// highlight-start
const client = new Client({
  url: "/api",
  headers: {
    "Content-Type": "application/json",
  },
  schemaConfig,
});
// highlight-end

export const Root = () => {
  return (
    // highlight-start
    <ClientContext.Provider value={client}>
      // highlight-end
      <App />
      // highlight-start
    </ClientContext.Provider>
    // highlight-end
  );
};

const root = document.querySelector("#app");

if (root != null) {
  createRoot(root).render(<Root />);
}
```

And you're ready to go!
