// InfoDocumenter's table in the local data file and the rules the database would enforce on it (slice 25), mirroring
// supabase/migrations/20261111120000_infodocumenter.sql. Registered with the store by `src/compose/`.

import { model, oneOf, type AnyRow, type TableRules } from "@/data/local/schema";
import { upgradeDocument } from "../domain/style";
import { DOCUMENT_PRESETS, SOURCE_KINDS, type DocumentDefinition, type InfoDocTable } from "../domain/types";

/** InfoDocumenter's table in the file, absent until its first row (the AD-31 schema check reads this interface). */
export interface InfoDocDb {
  document_definition: DocumentDefinition[];
}

const isObject = (v: unknown) => typeof v === "object" && v !== null && !Array.isArray(v);

export const INFODOC_RULES: Readonly<Record<InfoDocTable, TableRules>> = {
  document_definition: {
    key: ["id"],
    // slice 35: `baseline_id` points to a baseline (the SQL has had the key since slice 25)
    foreignKeys: { ...model, author_id: "app_user", baseline_id: "baseline" },
    checks: [
      { name: "document_definition_name_ck", test: (r: AnyRow) => typeof r.name === "string" && r.name.length > 0 && r.name === r.name.trim() },
      { name: "document_definition_preset_ck", test: oneOf(DOCUMENT_PRESETS, "preset") },
      // slice 36: the SQL's pairing, a baseline's id exactly with a baseline source (the key accepts a deleted baseline)
      {
        name: "document_definition_source_ck",
        test: (r: AnyRow) => oneOf(SOURCE_KINDS, "source_kind")(r) && (r.source_kind === "live" ? r.baseline_id === null : typeof r.baseline_id === "string"),
      },
      { name: "document_definition_recipe_ck", test: (r: AnyRow) => isObject(r.scope) && isObject(r.cover) && isObject(r.style) && Array.isArray(r.sections) },
    ],
    // slice 26 (F11): a recipe stored before it gets the style's defaults and the entries' heading and page break
    upgrade: (r: AnyRow) => upgradeDocument(r) as AnyRow | null,
  },
};
