// The ports' own sorts (slice 29, F1): one rule for both adapters. Lists without one are in the stored order
// (data-model-v2.md, "Conventions").

import type { SourceChange, SourceImport } from "@/domain/types";

/** A workspace's imports, newest first (slice 7a). */
export const newestImportFirst = (a: SourceImport, b: SourceImport): number => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id);

/** A workspace's changes to resolve, oldest first (slice 7b). */
export const oldestChangeFirst = (a: SourceChange, b: SourceChange): number => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
