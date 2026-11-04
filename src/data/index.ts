// The data store the server uses. Until the Supabase slice this is the local JSON-file adapter (AD-29),
// which refuses to start in production.

import { devDbPath } from "./local/file";
import type { LocalSchema } from "./local/schema";
import { createLocalDataStore } from "./local/store";
import type { DataStore } from "./ports";

export type { DataStore } from "./ports";

/**
 * `schema`: the tables the store knows (slice 15a, AD-33); InfoMapper's alone by default. Code that writes or undoes
 * passes the composition root's (`STORE_SCHEMA` from `@/compose`), so a module's rows are stored and undone.
 */
export function getDataStore(schema?: LocalSchema): DataStore {
  return createLocalDataStore(devDbPath(), schema);
}
