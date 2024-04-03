import { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Client, ClientContext } from "../src";
import { App } from "./components/App";

const client = new Client({
  url: "https://swapi-graphql.netlify.app/.netlify/functions/index",
  headers: {
    "Content-Type": "application/json",
  },
});

const Root = () => {
  return (
    <ClientContext.Provider value={client}>
      <Suspense fallback={<h1>Suspense loading</h1>}>
        <App />
      </Suspense>
    </ClientContext.Provider>
  );
};

const root = document.querySelector("#app");

if (root != null) {
  createRoot(root).render(<Root />);
}