// What InfoDocumenter's pages read (slice 25, step 4): the documents the person sees, filtered on the server so another's
// private document never reaches the browser (F15), and one document with the rights the page offers. A document the
// person does not see, or one while InfoDocumenter is off, answers null (the page's 404), never "forbidden".

import "server-only";
import type { DataStore } from "@/data";
import type { Uuid } from "@/domain/ids";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { AppUser } from "@/domain/types";
import { canSee, documentRights, openRefusal } from "../domain/rights";
import type { DocumentDefinition } from "../domain/types";

/** The `?gone=` the workspace home answers with its toast (`HOME_GONE` in `src/compose/home.tsx`, step 4b). */
export const GONE_DOCUMENT = "document";

export interface DocumentListRow {
  id: Uuid;
  name: string;
  audience: string | null;
  shared: boolean;
  /** Sections that are on, a skipped one included (D10). */
  sections: number;
  author: string;
  rights: ReturnType<typeof documentRights>;
  version: number;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });

/** The documents the person sees, by name: shared ones and their own private ones. */
export async function visibleDocuments(store: DataStore, access: WorkspaceAccess): Promise<DocumentListRow[]> {
  if (!access.member || !access.workspace.infodoc) return [];
  const [rows, people] = await Promise.all([store.modules.list(access.workspace.id, "document_definition"), store.users.listForWorkspace(access.workspace.id)]);
  return rows
    .filter((d) => canSee(access, d))
    .sort(byName)
    .map((d) => ({
      id: d.id,
      name: d.name,
      audience: d.audience,
      shared: d.shared,
      sections: d.sections.filter((s) => s.on).length,
      author: nameOf(people, d.author_id),
      rights: documentRights(access, d),
      version: d.version,
    }));
}

export const nameOf = (people: readonly AppUser[], id: Uuid): string => people.find((p) => p.id === id)?.display_name ?? "someone";

/** One document the person may open, or null. */
export async function openDocument(store: DataStore, access: WorkspaceAccess, documentId: string): Promise<DocumentDefinition | null> {
  const rows = await store.modules.list(access.workspace.id, "document_definition");
  const doc = rows.find((d) => d.id === documentId);
  return doc && !openRefusal(access, doc) ? doc : null;
}
