import { initGraphQLTada } from "gql.tada";
import type { introspection } from "./graphql-env.d.ts";

export const graphql = initGraphQLTada<{
  introspection: introspection;
  scalars: {
    ID: string;
    Currency: string;
    AmountValue: string;
    Date: string;
    PhoneNumber: string;
  };
}>();
