import { Option } from "@swan-io/boxed";

const OPERATION_TYPES = new Set(["Query", "Mutation", "Subscription"]);

export const getCacheEntryKey = (json: unknown): Option<symbol> => {
  if (typeof json === "object" && json != null) {
    if ("__typename" in json && typeof json.__typename === "string") {
      const typename = json.__typename;
      if (OPERATION_TYPES.has(typename)) {
        return Option.Some(Symbol.for(typename));
      }
      if ("id" in json && typeof json.id === "string") {
        return Option.Some(Symbol.for(`${typename}<${json.id}>`));
      }
    }
  }
  return Option.None();
};
