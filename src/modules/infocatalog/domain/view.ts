// What the search page draws (slice 39, S39-03): an answer as plain data the browser receives, built on the server from
// the search (`search.ts`) and the scope. Pure. The words are the PRD's and the prototype's (layout B).

import type { CatalogMark, CatalogTab } from "@/domain/catalog/items";
import type { DefinitionLine, TextRange } from "@/domain/catalog/match";
import type { Uuid } from "@/domain/ids";
import type { CatalogOrganization, CatalogWorkspace } from "@/domain/permissions";
import { ALL_TAB, type CatalogAnswer } from "./search";

/** The address's state (C7): the organization, the words, the scope (a workspace, or the whole organization) and the tab. */
export interface CatalogState {
  readonly org: Uuid;
  readonly q: string;
  readonly scope: Uuid | null;
  readonly kind: string;
  /** The item open in the drawer (`{kind}:{workspaceId}:{id}`), or none. */
  readonly item: string | null;
}

export interface CatalogRowView {
  readonly key: string;
  readonly kind: string;
  readonly kindLabel: string;
  readonly id: Uuid;
  readonly workspaceId: Uuid;
  readonly name: string;
  readonly nameRanges: readonly TextRange[];
  readonly path: string;
  readonly pathRanges: readonly TextRange[];
  readonly definition: DefinitionLine | null;
  /** The workspace's name, when more than one is in scope. */
  readonly workspace: string | null;
  readonly marks: readonly { text: string; tone: "pii" | "plain" }[];
}

export interface CatalogTabView {
  readonly key: string;
  readonly label: string;
  readonly count: number;
}

export interface CatalogView {
  readonly state: CatalogState;
  readonly tabs: readonly CatalogTabView[];
  readonly rows: readonly CatalogRowView[];
  /** The tab's results beyond the first 200. */
  readonly more: number;
  /** Every result of the tab (the rows and `more`). */
  readonly total: number;
  /** Whether more than one workspace is in scope (the Workspace column). */
  readonly many: boolean;
}

const STATUS_WORDS: Readonly<Record<string, string>> = { review: "In review" };
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");

/** A mark's words: "Personal data", a status, "Missing", "Retired". */
export function markText(m: CatalogMark): { text: string; tone: "pii" | "plain" } {
  if (m.t === "pii") return { text: "Personal data", tone: "pii" };
  if (m.t === "status") return { text: STATUS_WORDS[m.status] ?? capital(m.status), tone: "plain" };
  return { text: m.t === "missing" ? "Missing" : "Retired", tone: "plain" };
}

/** The scope's options: "Whole organization (n workspaces)", then "Workspace: {name}", archived ones marked. */
export const scopeOptions = (organization: CatalogOrganization): { value: string; label: string }[] => [
  { value: "", label: `Whole organization (${organization.workspaces.length} workspace${organization.workspaces.length === 1 ? "" : "s"})` },
  ...organization.workspaces.map((w) => ({ value: w.id, label: `Workspace: ${w.name}${w.archived ? " · Archived" : ""}` })),
];

/** "All" and the tabs shown: a module's only where it is on in a workspace in scope. */
export function shownTabs(tabs: readonly (CatalogTab & { on?: (w: CatalogWorkspace) => boolean })[], scope: readonly CatalogWorkspace[]): CatalogTab[] {
  return tabs.filter((t) => !t.on || scope.some(t.on));
}

export function catalogView(state: CatalogState, answer: CatalogAnswer, tabs: readonly CatalogTab[], scope: readonly CatalogWorkspace[]): CatalogView {
  const many = scope.length > 1;
  const names = new Map(scope.map((w) => [w.id, w]));
  const tabCounts: CatalogTabView[] = [{ key: ALL_TAB, label: "All", count: answer.counts[ALL_TAB] ?? 0 }, ...tabs.map((t) => ({ key: t.key, label: t.label, count: answer.counts[t.key] ?? 0 }))];
  const rows = answer.results.map((r) => {
    const w = names.get(r.item.workspaceId);
    return {
      key: `${r.item.workspaceId}:${r.item.kind}:${r.item.id}`,
      kind: r.item.kind,
      kindLabel: r.item.kindLabel,
      id: r.item.id,
      workspaceId: r.item.workspaceId,
      name: r.item.name,
      nameRanges: r.nameRanges,
      path: r.item.path,
      pathRanges: r.pathRanges,
      definition: r.definition,
      workspace: many && w ? w.name : null,
      marks: [...r.item.marks.map(markText), ...(w?.archived ? [{ text: "Archived", tone: "plain" as const }] : [])],
    };
  });
  const total = state.kind === ALL_TAB ? (state.q.trim() ? answer.counts[ALL_TAB] ?? 0 : 0) : answer.counts[state.kind] ?? 0;
  return { state, tabs: tabCounts, rows, more: answer.more, total, many };
}
