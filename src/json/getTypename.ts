export const getTypename = (json: unknown): string | undefined => {
  if (typeof json === "object" && json != null) {
    if (Array.isArray(json)) {
      return getTypename(json[0]);
    }
    if ("__typename" in json && typeof json.__typename === "string") {
      return json.__typename;
    }
  }
};
