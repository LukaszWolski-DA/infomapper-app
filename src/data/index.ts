// The data store the server uses. Until the Supabase slice this is the local JSON-file adapter (AD-29),
// which refuses to start in production.

import { devDbPath } from "./local/file";
import { createLocalDataStore } from "./local/store";
import type { DataStore } from "./ports";

export type { DataStore } from "./ports";

export function getDataStore(): DataStore {
  return createLocalDataStore(devDbPath());
}
