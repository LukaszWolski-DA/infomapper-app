// InfoDocumenter's table in the local data file and the rules the database would enforce on it (slice 25), mirroring
// supabase/migrations/20261111120000_infodocumenter.sql. Registered with the store by `src/compose/`.

import { model, oneOf, type AnyRow, type TableRules } from "@/data/local/schema";
import { ACCEPTED_SOURCE_KINDS, DOCUMENT_PRESETS, type DocumentDefinition, type InfoDocTable } from "../domain/types";

/** InfoDocumenter's table in the file, absent until its first row (the AD-31 schema check reads this interface). */
export interface InfoDocDb {
  document_definition: DocumentDefinition[];
}

const isObject = (v: unknown) => typeof v === "object" && v !== null && !Array.isArray(v);

export const INFODOC_RULES: Readonly<Record<InfoDocTable, TableRules>> = {
  document_definition: {
    key: ["id"],
    // `baseline_id` has no key here: the baseline table is not in the domain yet (F6; the SQL has it)
    foreignKeys: { ...model, author_id: "app_user" },
    checks: [
      { name: "document_definition_name_ck", test: (r: AnyRow) => typeof r.name === "string" && r.name.length > 0 && r.name === r.name.trim() },
      { name: "document_definition_preset_ck", test: oneOf(DOCUMENT_PRESETS, "preset") },
      // this slice accepts the live model only (F6): the SQL allows a baseline with its id, the local adapter refuses it
      { name: "document_definition_source_ck", test: (r: AnyRow) => oneOf(ACCEPTED_SOURCE_KINDS, "source_kind")(r) && r.baseline_id === null },
      { name: "document_definition_recipe_ck", test: (r: AnyRow) => isObject(r.scope) && isObject(r.cover) && Array.isArray(r.sections) },
    ],
  },
};
