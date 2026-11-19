// The organizations the seed makes (slice 31, Q8, F3): the reset's guard refuses while the database holds any other, and
// `pg:accounts` by default handles only the people of these. Compared by name, so neither names KB nor needs a marker.
import type { Queryable } from "../../src/data/postgres/pool";
import { seedRows } from "./seed-rows";

let names: ReadonlySet<string> | null = null;

/** The names of the organizations `pg:seed` loads (the demo's and "Performance test"'s). */
export function seedOrganizationNames(): ReadonlySet<string> {
  names ??= new Set(seedRows().organization.map((o) => o.name));
  return names;
}

/** The reset's refusal while the database holds organizations the seed does not make (deleted ones too), or null. */
export async function resetRefusal(db: Queryable, seed: ReadonlySet<string> = seedOrganizationNames()): Promise<string | null> {
  const { rows } = await db.query<{ name: string }>("select name from organization");
  const others = rows.filter((r) => !seed.has(r.name)).length;
  if (!others) return null;
  return (
    `The database holds ${others} organization${others === 1 ? "" : "s"} the seed does not make (KB's copy, or one made online): ` +
    "nothing was reset. First npm run pg:backup, then npm run pg:kb -- --remove, then the reset."
  );
}

export interface Membership {
  user_id: string;
  organization: string;
}

/**
 * The people `pg:accounts` handles by default: those whose every organization and workspace membership is in a seed
 * organization, and who have one at least. A person of any other organization (KB's) is left out, so the demo's password
 * never reaches their account and their e-mail is never printed.
 */
export function seedPeople(people: readonly string[], memberships: readonly Membership[], seed: ReadonlySet<string> = seedOrganizationNames()): { handled: string[]; leftOut: number } {
  const of = new Map<string, string[]>();
  for (const m of memberships) (of.get(m.user_id) ?? of.set(m.user_id, []).get(m.user_id)!).push(m.organization);
  const handled = people.filter((p) => {
    const orgs = of.get(p) ?? [];
    return orgs.length > 0 && orgs.every((o) => seed.has(o));
  });
  return { handled, leftOut: people.length - handled.length };
}
