// Source tables and the Classification register (slice 26, the prototype's `sources` and `classreg`). Pure: the source
// tables in scope (F13, `sectionScopeOf`), the workspace's classifications (D-78, the classification index), the
// modeller's notes, the columns that left the source, what reads each column, and the Data Vault reading (`dataVaultReading`,
// slice 7c) in the document's language (D3: its lines are structured, so only the words are the document's).

import { joined, lines, longTextTable, mono, muted, statusShown, text, typeRuns, type LongColumn } from "@/domain/document/blocks";
import type { DocNode, DocRuns } from "@/domain/document/content";
import type { SectionBuildInput } from "@/domain/document/sections";
import type { DocumentState } from "@/domain/document/state";
import type { Uuid } from "@/domain/ids";
import { isBuiltin, isDataVault } from "@/domain/model/classifications";
import { dataVaultReading, type ReadingLine } from "@/domain/model/data-vault-reading";
import { formatColumnType } from "@/domain/model/type-check";
import type { Classification, SourceTable } from "@/domain/types";
import { attributeLabel, attributesOf, columnRuns, leftRuns, scopeEntities, wordsOf, type L } from "./parts";
import { registerOptions, sourcesOptions, type SourceColumnField } from "./sections";

/** Classifications as the workspace names them; a code beside a name that is not the code (the prototype's `clsTxt`). */
function classificationRuns(state: DocumentState, objectId: Uuid): DocRuns {
  const visible = state.classifications.of(objectId).filter((c) => !isDataVault(c) || state.snapshot.workspace.dv2_mode);
  return joined(
    visible.map((c) => {
      const code = c.code?.replace(/^T_/, "") ?? null;
      return code && code.toLowerCase() !== c.name.toLowerCase() ? [text(c.name), text(" "), { ...mono(code), muted: true }] : [text(c.name)];
    }),
  );
}

/** "{system} / {database}.{schema}" (the prototype's `srcPath`). */
const tablePath = (state: DocumentState, x: SourceTable): string => `${state.system.get(x.source_system_id)?.name ?? "?"} / ${[x.database_name, x.schema_name].filter(Boolean).join(".")}`;

/** The logical attributes a column is read into by the shown mappings ("Used by"). */
function usedByRuns(state: DocumentState, columnId: Uuid, filter: SectionBuildInput["scope"]["mappings"]): DocRuns {
  const ms = (state.lookup.mappingsOfColumn.get(columnId) ?? []).filter((m) => statusShown(filter, m.status));
  return lines(ms.map((m) => [mono(attributeLabel(state, m.attribute_id))]));
}

/** A Data Vault reading's line in the document's words (D3; the prototype's `dvRead`), the names in a mono font. */
function readingRuns(line: ReadingLine, t: L): DocRuns {
  const names = (list: readonly string[]): DocRuns => joined(list.map((n) => [mono(n)]));
  /** A label with one `{c}` (and `{t}`) filled with runs. */
  const fill = (key: Parameters<L>[0], c: DocRuns, values: Record<string, string> = {}): DocRuns => {
    const [before, after = ""] = t(key, { ...values, c: "\u0000" }).split("\u0000");
    return [...(before ? [text(before)] : []), ...c, ...(after ? [text(after)] : [])];
  };
  switch (line.kind) {
    case "hub":
      return fill("dv_hub", names(line.columns));
    case "hub_candidate":
      return [text(t("dv_hubCand"))];
    case "link":
      return [...fill("dv_link", names(line.columns), { t: line.to }), ...(line.markedLinkKey ? [] : [muted(t("dv_notLK"))])];
    case "link_key_without_relationship":
      return fill("dv_lkNo", names(line.columns));
    case "dependent_child_key":
      return fill("dv_dck", names(line.columns));
    case "driving_key":
      return fill("dv_dk", names(line.columns));
    case "multi_active":
      return fill("dv_mak", names(line.columns));
    case "effective_dated":
      return fill("dv_eff", names(line.columns));
    case "satellite":
      return [text(t("dv_sat", { n: line.descriptive })), ...(line.personalData.length ? fill("dv_satPii", names(line.personalData), { n: String(line.personalData.length) }) : [])];
  }
}

const SOURCE_LABEL: Record<SourceColumnField, Parameters<L>[0]> = { column: "column", type: "type", keys: "keys", classifications: "classif", usedBy: "usedBy", note: "note" };

/**
 * Each source table in scope (F13), in the model's order: its name, its path and its classifications, the modeller's
 * note, its columns with the chosen properties (the note a long text, D1), and in Data Vault 2.0 mode its reading.
 */
export function buildSources({ state, scope, options, language }: SectionBuildInput): DocNode[] {
  const o = sourcesOptions.parse(options);
  const t = wordsOf(language);
  const ws = state.snapshot.workspace;
  const head: LongColumn[] = o.columns.map((c) => ({ key: c, label: t(SOURCE_LABEL[c]), long: c === "note" }));
  const out: DocNode[] = [];
  for (const x of state.snapshot.model.sourceTables) {
    if (!scope.tableIds.has(x.id)) continue;
    const nodes: DocNode[] = [{ kind: "heading", level: 3, text: x.name }];
    const meta: DocRuns[] = [[mono(tablePath(state, x))]];
    const classes = o.tableClassifications ? classificationRuns(state, x.id) : [];
    if (classes.length) meta.push([text(`${t("classif")}: `), ...classes]);
    nodes.push({ kind: "meta", parts: meta });
    if (o.tableNote && x.note_text?.trim()) nodes.push({ kind: "paragraph", runs: [text(x.note_text)] });
    const rows = (state.lookup.columnsOf.get(x.id) ?? []).map((c) =>
      o.columns.map((k): DocRuns => {
        switch (k) {
          case "column":
            return [mono(c.name), ...leftRuns(c, t)];
          case "type":
            return [mono(formatColumnType(c))];
          case "keys": {
            const keys = [c.is_primary_key && "PK", c.is_foreign_key && "FK"].filter(Boolean).join(" ");
            return keys ? [mono(keys)] : [];
          }
          case "classifications":
            return classificationRuns(state, c.id);
          case "usedBy":
            return usedByRuns(state, c.id, scope.mappings);
          case "note":
            return c.note_text?.trim() ? [text(c.note_text)] : [];
        }
      }),
    );
    nodes.push(...longTextTable(head, rows, o.longTexts, t("none")));
    if (o.dataVault && ws.dv2_mode) {
      const reading = dataVaultReading(
        {
          table: x,
          columns: state.lookup.columnsOf.get(x.id) ?? [],
          relationships: state.snapshot.model.sourceRelationships,
          relationshipColumns: state.snapshot.model.sourceRelationshipColumns,
          tableName: (id) => state.table.get(id)?.name ?? "?",
        },
        state.classifications,
      );
      nodes.push({ kind: "heading", level: 4, text: t("dv_title") });
      if (reading.length) nodes.push({ kind: "list", items: reading.map((l) => ({ runs: readingRuns(l, t) })) }, { kind: "meta", parts: [[text(t("dv_hint"))]] });
      else nodes.push({ kind: "paragraph", runs: [muted(t("dv_none"))] });
    }
    out.push({ kind: "group", nodes, mark: "#A0660F" });
  }
  return out.length ? out : [{ kind: "paragraph", runs: [muted(t("none"))] }];
}

/** A register's key of a classification: a built-in one's code, an own one's id (D-78: an own one may have no code). */
export const registerKey = (c: Pick<Classification, "id" | "code" | "origin">): string => (isBuiltin(c) && c.code ? c.code : c.id);

/**
 * Each chosen classification (in the workspace's list order; Data Vault ones only in Data Vault 2.0 mode), with its
 * definition and where the scope uses it: the source tables, or the source columns with what reads them; under
 * personal data also the scope's logical attributes marked as personal data, when chosen.
 */
export function buildRegister({ state, scope, options, language }: SectionBuildInput): DocNode[] {
  const o = registerOptions.parse(options);
  const t = wordsOf(language);
  const ws = state.snapshot.workspace;
  const tables = state.snapshot.model.sourceTables.filter((x) => scope.tableIds.has(x.id));
  const chosen = state.classifications.list.filter((c) => o.classifications.includes(registerKey(c)) && (!isDataVault(c) || ws.dv2_mode));
  if (!chosen.length) return [{ kind: "paragraph", runs: [muted(t("none"))] }];
  const out: DocNode[] = [];
  for (const c of chosen) {
    out.push({ kind: "heading", level: 2, text: c.name });
    if (c.definition) out.push({ kind: "paragraph", runs: [text(c.definition)] });
    if (c.scope === "table") {
      const rows = tables
        .filter((x) => state.classifications.of(x.id).some((k) => k.id === c.id))
        .map((x) => [[mono(x.name)], [text(state.system.get(x.source_system_id)?.name ?? "")], classificationRuns(state, x.id), x.note_text?.trim() ? [text(x.note_text)] : []]);
      out.push(
        ...longTextTable(
          [
            { key: "table", label: t("tables") },
            { key: "system", label: t("system") },
            { key: "classifications", label: t("classif") },
            { key: "note", label: t("note"), long: true },
          ],
          rows,
          o.longTexts,
          t("noneCls"),
        ),
      );
      continue;
    }
    const rows = tables.flatMap((x) =>
      (state.lookup.columnsOf.get(x.id) ?? [])
        .filter((col) => state.classifications.of(col.id).some((k) => k.id === c.id))
        .map((col) => [columnRuns(state, col, t), [mono(formatColumnType(col))], classificationRuns(state, col.id), usedByRuns(state, col.id, scope.mappings), col.note_text?.trim() ? [text(col.note_text)] : []]),
    );
    out.push(
      ...longTextTable(
        [
          { key: "column", label: t("srcCol") },
          { key: "type", label: t("type") },
          { key: "classifications", label: t("classif") },
          { key: "usedBy", label: t("usedBy") },
          { key: "note", label: t("note"), long: true },
        ],
        rows,
        o.longTexts,
        t("noneCls"),
      ),
    );
    if (c.code === "PII" && isBuiltin(c) && o.attributes) {
      const attributes = scopeEntities(state, scope)
        .filter((e) => e.model_level === "logical")
        .flatMap((e) => attributesOf(state, e.id).filter((a) => a.is_pii));
      if (attributes.length)
        out.push(
          { kind: "heading", level: 4, text: t("piiAttrs") },
          {
            kind: "table",
            columns: [
              { key: "attribute", label: t("attribute") },
              { key: "type", label: t("type") },
              { key: "from", label: t("mappedFrom") },
            ],
            rows: attributes.map((a) => ({
              cells: [
                [mono(attributeLabel(state, a.id))],
                typeRuns(a),
                lines((state.lookup.mappingsOfAttribute.get(a.id) ?? []).filter((m) => statusShown(scope.mappings, m.status)).flatMap((m) => (state.lookup.inputsOf.get(m.id) ?? []).map((col) => columnRuns(state, col, t)))),
              ],
            })),
          },
        );
    }
  }
  return out;
}
