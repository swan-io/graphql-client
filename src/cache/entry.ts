import { CONNECTION_REF, REQUESTED_KEYS } from "../utils";

export type CacheEntry = Record<symbol, unknown> & {
  [REQUESTED_KEYS]: Set<symbol>;
  [CONNECTION_REF]?: number;
};

export const createEmptyCacheEntry = (): CacheEntry => ({
  [REQUESTED_KEYS]: new Set<symbol>(),
});
