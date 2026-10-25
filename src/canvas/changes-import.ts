// The imports the Changes view's select offers and the chip names (slice 7b, item 26). A module with no dependencies,
// so the canvas page (a server component) builds them and the system panel names an import the same way.

import type { Uuid } from "@/domain/ids";

/** An import the bar's select offers (newest first), built on the server. */
export interface ChangesImport {
  id: Uuid;
  /** “Import into CRM, 25 Oct 2026, 09:44, crm_snapshot.csv” */
  label: string;
  /** “import into CRM, 25 Oct 2026” */
  chip: string;
}

/** An import as the bar's select and the chip name it; `at` is the imports list's “25 Oct 2026, 09:44”. */
export const changesImport = (id: Uuid, system: string, at: string, source: string): ChangesImport => ({
  id,
  label: `Import into ${system}, ${at}, ${source}`,
  chip: `import into ${system}, ${at.split(",")[0]}`,
});

