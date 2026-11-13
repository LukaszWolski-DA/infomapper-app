// Model overview and Conventions and notation (slice 26, the prototype's `overview` without figures, D4, and `conv`).
// Pure: each reads the document's model state and the app's own rules (the stereotypes' index and uses, D-79; the
// classification index, D-78; the logical type a physical one reads as; the workspace's naming conventions and
// four-eyes), in the document's language.

import { chip, EMPTY, longTextTable, mono, muted, statusShown, strong, text } from "@/domain/document/blocks";
import type { DocNode, DocRuns } from "@/domain/document/content";
import type { SectionBuildInput } from "@/domain/document/sections";
import { isBuiltin, isDataVault } from "@/domain/model/classifications";
import { stereotypeUses } from "@/domain/model/stereotypes";
import { baseType, formatColumnType, logicalTypeOf } from "@/domain/model/type-check";
import type { Uuid } from "@/domain/ids";
import { attributesOf, byConcept, scopeEntities, wordsOf } from "./parts";
import { conventionsOptions, overviewOptions } from "./sections";

/** Plain text as paragraphs: a blank line starts one (D-80's Text, D11). */
export const paragraphs = (body: string | null | undefined): DocNode[] =>
  (body ?? "")
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({ kind: "paragraph", runs: p.split("\n").map((l, i) => (i ? { text: l, lineBreak: true } : text(l))) }));

// ---- Model overview (D4: as the prototype) ----

/**
 * The workspace's description; the counts (the scope's entities, its source tables, the shown mappings onto its
 * entities with how many are approved, every requirement); the concepts with their entities in scope.
 */
export function buildOverview({ state, scope, options, language }: SectionBuildInput): DocNode[] {
  const o = overviewOptions.parse(options);
  const t = wordsOf(language);
  const entities = scopeEntities(state, scope);
  const out: DocNode[] = [...paragraphs(state.snapshot.workspace.description)];
  if (o.stats) {
    const mappings = entities.flatMap((e) => attributesOf(state, e.id).flatMap((a) => state.lookup.mappingsOfAttribute.get(a.id) ?? [])).filter((m) => statusShown(scope.mappings, m.status));
    const approved = mappings.filter((m) => m.status === "approved").length;
    out.push({
      kind: "table",
      style: "narrow",
      columns: [
        { key: "what", label: t("contents") },
        { key: "count", label: t("count") },
      ],
      rows: [
        { cells: [[text(t("entities"))], [text(String(entities.length))]] },
        { cells: [[text(t("tables"))], [text(String(scope.tableIds.size))]] },
        { cells: [[text(t("mappings"))], [text(`${mappings.length} `), muted(`(${approved} ${t("approved").toLowerCase()})`)]] },
        { cells: [[text(t("reqN"))], [text(String(state.requirements.requirements.length))]] },
      ],
    });
  }
  if (o.concepts) {
    const groups = [...byConcept(state, entities)];
    if (groups.length)
      out.push({
        kind: "list",
        plain: true,
        items: groups.map(([id, list]) => {
          const c = state.concept.get(id)!;
          return { runs: [{ text: "", swatch: c.color }, strong(c.name), text("  "), muted(list.map((e) => e.name).join(", "))] };
        }),
      });
  }
  return out;
}

// ---- Conventions and notation ----

const ENDS: readonly { key: "c_one" | "c_01" | "c_1n" | "c_0n"; min: 0 | 1; many: boolean }[] = [
  { key: "c_one", min: 1, many: false },
  { key: "c_01", min: 0, many: false },
  { key: "c_1n", min: 1, many: true },
  { key: "c_0n", min: 0, many: true },
];

/**
 * How to read the document (the prototype's `conv`): the relationship notation in the document's notation (step 4's
 * style; crow's foot until then), the mapping statuses (and four-eyes when on), the marks, the stereotypes the scope's
 * logical entities use (names and definitions from the workspace's list, D-79), the classifications its source tables
 * use (D-78; Data Vault ones only in Data Vault 2.0 mode), the physical types in its sources with their logical types,
 * and the naming conventions: the workspace's, then the document's own.
 */
export function buildConventions({ state, scope, options, language }: SectionBuildInput): DocNode[] {
  const o = conventionsOptions.parse(options);
  const t = wordsOf(language);
  const ws = state.snapshot.workspace;
  const model = state.snapshot.model;
  const out: DocNode[] = [];
  const legend = (labels: string[], rows: DocRuns[][]): DocNode => ({
    kind: "table",
    style: "legend",
    columns: labels.map((label, i) => ({ key: `c${i}`, label })),
    rows: rows.map((cells) => ({ cells })),
  });
  if (o.notation) {
    out.push({ kind: "heading", level: 2, text: t("c_notation") }, legend(["", t("meaning")], ENDS.map((e) => [[{ text: "", end: { notation: "ie", min: e.min, many: e.many } }], [text(t(e.key))]])));
  }
  if (o.statuses) {
    out.push(
      { kind: "heading", level: 2, text: t("c_status") },
      legend(
        ["", t("status"), t("meaning")],
        (["draft", "review", "approved"] as const).map((s) => [[{ text: "", line: s }], [{ text: t(s), pill: true, status: s }], [text(t(`s_${s}`))]]),
      ),
    );
    if (ws.four_eyes) out.push({ kind: "paragraph", runs: [text(t("fourEyes"))] });
  }
  if (o.marks) {
    out.push(
      { kind: "heading", level: 2, text: t("c_marks") },
      legend(
        [t("mark"), t("meaning")],
        [
          [[strong("PK")], [text(t("m_pk"))]],
          [[strong("FK")], [text(t("m_fk"))]],
          [[chip("BK", "bk")], [text(t("m_bk"))]],
          [[chip("PII", "pii")], [text(t("m_pii"))]],
          [[{ ...mono("="), strong: true }], [text(t("m_calc"))]],
          [[{ text: "ƒ", circle: "map" }], [text(t("m_f"))]],
          [[{ text: "!", circle: "warn" }], [text(t("m_warn"))]],
          [[{ text: "", dots: true }], [text(t("m_dot"))]],
        ],
      ),
    );
  }
  if (o.stereotypes) {
    const uses = stereotypeUses(scopeEntities(state, scope).filter((e) => e.model_level === "logical"));
    const rows = state.stereotypes.live.filter((s) => uses[s.code]).map((s) => [[strong(s.name)], [text(String(uses[s.code]))], s.definition ? [text(s.definition)] : EMPTY]);
    out.push(
      { kind: "heading", level: 2, text: t("c_stereo") },
      ...longTextTable(
        [
          { key: "name", label: t("stereotype") },
          { key: "used", label: t("used") },
          { key: "def", label: t("def"), long: true },
        ],
        rows,
        "row",
        t("none"),
      ),
    );
  }
  const tables = model.sourceTables.filter((x) => scope.tableIds.has(x.id));
  if (o.classifications) {
    const used = new Map<Uuid, number>();
    const count = (id: Uuid) => {
      for (const c of state.classifications.of(id)) used.set(c.id, (used.get(c.id) ?? 0) + 1);
    };
    for (const x of tables) {
      count(x.id);
      for (const c of state.lookup.columnsOf.get(x.id) ?? []) count(c.id);
    }
    const rows = state.classifications.list
      .filter((c) => used.get(c.id) && (!isDataVault(c) || ws.dv2_mode))
      .map((c) => [
        isBuiltin(c) ? [text(c.name)] : [text(c.name), muted(` (${t("own")})`)],
        c.code ? [mono(c.code)] : EMPTY,
        [text(t(c.scope === "table" ? "appTbl" : "appCol") + (isDataVault(c) ? " · Data Vault" : ""))],
        [text(String(used.get(c.id)))],
        c.definition ? [text(c.definition)] : EMPTY,
      ]);
    out.push(
      { kind: "heading", level: 2, text: t("c_cls") },
      ...longTextTable(
        [
          { key: "name", label: t("classif") },
          { key: "code", label: t("code") },
          { key: "scope", label: t("scopeL") },
          { key: "used", label: t("used") },
          { key: "def", label: t("def"), long: true },
        ],
        rows,
        "row",
        t("none"),
      ),
    );
  }
  if (o.types) {
    const byBase = new Map<string, { physical: Set<string>; logical: string }>();
    for (const x of tables)
      for (const c of state.lookup.columnsOf.get(x.id) ?? []) {
        const base = baseType(c.data_type);
        const entry = byBase.get(base) ?? byBase.set(base, { physical: new Set(), logical: logicalName(logicalTypeOf(c)) }).get(base)!;
        entry.physical.add(formatColumnType(c));
      }
    const rows = [...byBase.keys()].sort().map((b) => {
      const e = byBase.get(b)!;
      return { cells: [[mono([...e.physical].sort().join(", "))], [text(e.logical)]] };
    });
    out.push(
      { kind: "heading", level: 2, text: t("c_types") },
      rows.length
        ? {
            kind: "table",
            style: "narrow",
            columns: [
              { key: "physical", label: t("phys") },
              { key: "logical", label: t("logical") },
            ],
            rows,
          }
        : { kind: "paragraph", runs: [muted(t("none"))] },
    );
  }
  const naming = [...paragraphs(ws.naming_conventions), ...paragraphs(o.naming)];
  if (naming.length) out.push({ kind: "heading", level: 2, text: t("c_naming") }, ...naming);
  return out.length ? out : [{ kind: "paragraph", runs: [muted(t("none"))] }];
}

const logicalName = (type: ReturnType<typeof logicalTypeOf>): string => (type.data_type === "custom" ? (type.custom_type ?? "custom") : type.data_type);
