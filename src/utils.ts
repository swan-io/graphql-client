export const DEEP_MERGE_DELETE = Symbol.for("DEEP_MERGE_DELETE");

export const deepMerge = (target: any, source: any): any => {
  const next: any = Array.isArray(target)
    ? Array(target.length)
    : Array.isArray(source)
      ? Array(source.length)
      : {};

  Object.getOwnPropertyNames(target).forEach((name) => {
    // instruction to remove existing field
    if (source[name] !== DEEP_MERGE_DELETE) {
      next[name] = target[name];
    }
  });

  Object.getOwnPropertySymbols(target).forEach((name) => {
    // instruction to remove existing field
    if (source[name] !== DEEP_MERGE_DELETE) {
      next[name] = target[name];
    }
  });

  Object.getOwnPropertyNames(source).forEach((name) => {
    // instruction to remove existing field
    if (source[name] !== DEEP_MERGE_DELETE) {
      if (isRecord(next[name]) && isRecord(source[name])) {
        next[name] = deepMerge(next[name], source[name]);
      } else {
        next[name] = source[name];
      }
    }
  });

  Object.getOwnPropertySymbols(source).forEach((name) => {
    // instruction to remove existing field
    if (source[name] !== DEEP_MERGE_DELETE) {
      if (isRecord(next[name]) && isRecord(source[name])) {
        next[name] = deepMerge(next[name], source[name]);
      } else {
        next[name] = source[name];
      }
    }
  });

  return next;
};

export const containsAll = <T>(a: Set<T>, b: Set<T>): boolean => {
  const keys = [...b.values()];
  return keys.every((key) => a.has(key));
};

export const isRecord = (
  value: unknown,
): value is Record<PropertyKey, unknown> => {
  return value != null && typeof value === "object";
};

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
    if (!b.hasOwnProperty(key) || !deepEqual(a[key], b[key])) {
      return false;
    }
  }

  return true;
};

export const serializeVariables = (variables: Record<string, any>) => {
  return JSON.stringify(variables);
};
