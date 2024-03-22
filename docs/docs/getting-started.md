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

## 2. Create your client

```ts title="src/index.tsx"
import { Client, ClientContext } from "@swan-io/graphql-client";
import { App } from "./App";
import { createRoot } from "react-dom/client";

// highlight-start
const client = new Client({
  url: "/api",
  headers: {
    "Content-Type": "application/json",
  },
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
