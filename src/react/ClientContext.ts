import { createContext } from "react";
import { Client } from "../client";

export const ClientContext = createContext(
  new Client({ url: "/graphql", schemaConfig: { interfaceToTypes: {} } }),
);
