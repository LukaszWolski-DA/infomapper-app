// The data store the server uses (slice 29, Q4): the local JSON-file adapter (AD-29) by default, which refuses to start
// in production and on Postgres; the Postgres adapter when `INFOMAPPER_DATA=postgres` (`./mode.ts`), reads only until
// slice B. The two never mix: each mode builds only its own store.

import { devDbPath } from "./local/file";
import type { LocalSchema } from "./local/schema";
import { createLocalDataStore } from "./local/store";
import { dataMode } from "./mode";
import type { DataStore } from "./ports";
import { createPostgresDataStore } from "./postgres/store";
import { isTimingOn, timedStore } from "./timing";

export type { DataStore } from "./ports";
export { dataMode, isPostgresMode, type DataMode } from "./mode";

/**
 * `schema`: the tables the store knows (slice 15a, AD-33); InfoMapper's alone by default. Code that writes or undoes
 * passes the composition root's (`STORE_SCHEMA` from `@/compose`), so a module's rows are stored and undone.
 */
export function getDataStore(schema?: LocalSchema): DataStore {
  const store = dataMode() === "postgres" ? createPostgresDataStore(schema) : createLocalDataStore(devDbPath(), schema);
  // slice 29 (Q9): counted and timed only with INFOMAPPER_TIMING=1
  return isTimingOn() ? timedStore(store) : store;
}
