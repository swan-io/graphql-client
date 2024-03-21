import { createRoot } from "react-dom/client";
import { Client, ClientContext } from "../src";
import { App } from "./components/App";

const yourAuthBearer = "your-auth-bearer";

const client = new Client({
  url: "/api",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${yourAuthBearer}`,
  },
});

const Root = () => {
  return (
    <ClientContext.Provider value={client}>
      <App />
    </ClientContext.Provider>
  );
};

const root = document.querySelector("#app");

if (root != null) {
  createRoot(root).render(<Root />);
}
