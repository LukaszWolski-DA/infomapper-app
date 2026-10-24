// A system's imports as its panel lists them (slice 7a, item 38): date and time, the source label, who, and the
// summary, newest first. Built on the server (the page), so the time is the server's local time and the client renders
// the same text.

import { importSummary } from "@/domain/import/plan";
import type { SourceImport } from "@/domain/types";

export interface SystemImport {
  id: string;
  systemId: string;
  /** “23 Oct 2026, 09:44” */
  at: string;
  label: string;
  by: string;
  /** “2 new tables, 5 new columns, …” or “No changes” (item 28). */
  summary: string;
}

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

/** `imports` newest first, as `model.listImports` gives them. */
export function systemImports(imports: readonly SourceImport[], userName: (id: string) => string): SystemImport[] {
  return imports.map((i) => ({ id: i.id, systemId: i.source_system_id, at: when(i.created_at), label: i.source_label, by: userName(i.created_by), summary: importSummary(i) }));
}
