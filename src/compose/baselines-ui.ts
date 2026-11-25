// What the modules add to the Baselines tab (slice 36, step 1's F1, D-88 as proposed): the tab is InfoMapper's and never
// names a module (AD-33), so InfoDocumenter's "New document from it" in each baseline's row, "Make a document" in the
// Compare dialog and the delete dialog's documents' line come through here, as plain data and server actions the tab
// draws. Without a module that offers them the tab is slice 35's.

import type { DataStore } from "@/data/ports";
import type { WorkspaceAccess } from "@/domain/permissions";
import { createChangesDocumentAction, createDocumentFromBaselineAction } from "@/modules/infodocumenter/app/actions";
import { BASELINE_TEXTS } from "@/modules/infodocumenter/domain/commands";
import { createRefusal } from "@/modules/infodocumenter/domain/rights";
import { baselineDocumentCounts } from "./document-model";

/** A module's action's answer: the page it opens, or the refusal the tab shows. */
export type OpenAnswer = { ok: true; value: { href: string } } | { ok: false; code: string; message: string };

/** A button a module adds: its words, its test id and the server action it runs. */
export interface BaselineAction<I> {
  readonly label: string;
  readonly testId: string;
  readonly title?: string;
  readonly run: (input: I) => Promise<OpenAnswer>;
}

export interface BaselineExtensions {
  /** After "Compare…" in each baseline's row. */
  readonly rowAction: BaselineAction<{ workspaceId: string; baselineId: string }> | null;
  /** Before "Close" in the Compare dialog: the two states as the dialog shows them (null: Now). */
  readonly compareAction: BaselineAction<{ workspaceId: string; olderId: string; newerId: string | null }> | null;
  /** The delete dialog's line by baseline id, only where something is made from it. */
  readonly deleteLines: Readonly<Record<string, string>>;
}

export const NO_BASELINE_EXTENSIONS: BaselineExtensions = { rowAction: null, compareAction: null, deleteLines: {} };

/**
 * The tab's additions for the person (Q8, F14): InfoDocumenter's buttons for whoever may make documents (its rights,
 * InfoDocumenter on); the documents' line counted on the server, every author's documents, a number only.
 */
export async function baselineExtensions(store: DataStore, access: WorkspaceAccess): Promise<BaselineExtensions> {
  const counts = await baselineDocumentCounts(store, access.workspace.id);
  const deleteLines = Object.fromEntries(Object.entries(counts).flatMap(([id, n]) => (n ? [[id, BASELINE_TEXTS.documentsLine(n)]] : [])));
  const makes = createRefusal(access) === null;
  return {
    rowAction: makes ? { label: BASELINE_TEXTS.newFromIt, testId: "button-baseline-new-document", run: createDocumentFromBaselineAction } : null,
    compareAction: makes ? { label: BASELINE_TEXTS.makeDocument, testId: "button-compare-make-document", title: BASELINE_TEXTS.makeDocumentTitle, run: createChangesDocumentAction } : null,
    deleteLines,
  };
}
