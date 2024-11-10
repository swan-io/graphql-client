export const REQUESTED_KEYS = Symbol.for("__requestedKeys");

export const CONNECTION_REF = "__connectionRef";

export const TYPENAME_KEY = Symbol.for("__typename");
export const EDGES_KEY = Symbol.for("edges");
export const NODE_KEY = Symbol.for("node");

export const containsAll = <T>(a: Set<T>, b: Set<T>): boolean => {
  const keys = [...b.values()];
  return keys.every((key) => a.has(key));
};

export const isRecord = (
  value: unknown,
): value is Record<PropertyKey, unknown> => {
  return value != null && typeof value === "object";
};

export const hasOwnProperty = Object.prototype.hasOwnProperty;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const deepEqual = (a: any, b: any): boolean => {
  if (Object.is(a, b)) {
    return true;
  }

  if (
    typeof a !== "object" ||
    a === null ||
    typeof b !== "object" ||
    b === null
  ) {
    return false;
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  for (const key of aKeys) {
    if (!hasOwnProperty.call(b, key) || !deepEqual(a[key], b[key])) {
      return false;
    }
  }

  return true;
};

export const serializeVariables = (variables: Record<string, unknown>) => {
  return JSON.stringify(variables);
};
