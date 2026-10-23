// P8, a review never goes stale silently (slice 7a; step 1, answer 12): the server builds the plan again from the same
// text and choices, and writes only when it does what the review showed. `planDigest` is what the review showed, in a
// form two plans can be compared by: every status and change, every rename, every mapping's impact, the warnings, and
// the id and version of every row the import reads for them. An edit elsewhere in the workspace does not change it;
// anything that changes what the import does, does. `keptChoices` is what a refreshed review keeps.

import type { ImportPlan, PlanChoices } from "./plan";

export const STALE_REVIEW = (system: string) =>
  `${system} changed since you opened this review. The review now shows the current state; check it and import again.`;

const row = (r: { id: string; version: number } | null) => (r ? `${r.id}@${r.version}` : null);

export function planDigest(plan: ImportPlan): string {
  return JSON.stringify({
    target: plan.target,
    errors: plan.errors,
    warnings: plan.warnings,
    compare: plan.compare,
    leftOut: plan.leftOut,
    tables: plan.tables.map((t) => ({
      key: t.key,
      status: t.status,
      existing: row(t.existing),
      meta: t.meta,
      rows: t.rows,
      columns: t.columns.map((c) => ({
        status: c.status,
        existing: row(c.existing),
        file: c.file?.name ?? null,
        changes: c.changes,
        position: c.position,
        rename: c.renameKey,
        classifications: c.fileClassifications,
        mappings: c.mappingIds,
      })),
    })),
    relationships: plan.relationships.map((r) => ({ status: r.status, name: r.name, renamedFrom: r.renamedFrom, from: r.fromKey, to: r.toKey, pairs: r.pairs, existing: row(r.existing) })),
    renames: plan.renames.map((r) => [r.key, r.choice, r.suggested, r.options]),
    mappings: plan.mappings.map((m) => ({ id: row({ id: m.mappingId, version: m.version }), status: m.status, back: m.sendsBack, reasons: m.reasons, conflicts: m.conflicts, fits: m.fitsAgain, rule: m.ruleAfter })),
    mass: plan.massWarning,
  });
}

/** Whether the plan the server built does what the review showed. */
export const samePlan = (shown: string, rebuilt: ImportPlan): boolean => shown === planDigest(rebuilt);

/** 53 bits of a string (cyrb53): not for secrets, only to tell two digests apart. */
function hash53(text: string, seed: number): number {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * The digest in a few characters (two 53-bit hashes and its length), what the review sends with the import: a plan of
 * 100,000 columns has a digest of many megabytes, and P8 only needs to know whether the two are the same.
 */
export function planFingerprint(plan: ImportPlan): string {
  const digest = planDigest(plan);
  return `${hash53(digest, 1).toString(36)}-${hash53(digest, 2).toString(36)}-${digest.length.toString(36)}`;
}

/**
 * The choices a refreshed review keeps (P8): the scope and the compare choice as they were (the file has not changed),
 * and each rename choice whose gone column is still offered with the chosen new column (or “removed”).
 */
export function keptChoices(choices: PlanChoices, rebuilt: ImportPlan): PlanChoices {
  const offered = new Map(rebuilt.renames.map((r) => [r.key, r]));
  const renames = new Map<string, string>();
  for (const [key, choice] of choices.renames) {
    const r = offered.get(key);
    if (r && (choice === "" || r.options.includes(choice))) renames.set(key, choice);
  }
  return { scope: choices.scope, compare: choices.compare, renames };
}
