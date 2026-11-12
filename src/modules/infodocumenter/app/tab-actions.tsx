"use client";

// The Documentation tab's buttons (slice 25, step 4): New document with its presets (create, then open the form, D13),
// and a row's Edit or Open, Duplicate and Delete with its question (D10). Documents are outside undo: no Undo in the
// toasts.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/app/_components/use-action";
import { buttonClass, dangerClass, primaryClass, smallButtonClass } from "@/app/_panels/fields";
import { documentHref } from "@/app/_lib/paths";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/ui/components/dialog";
import { DOCUMENT_TEXTS } from "../domain/commands";
import type { DocumentPreset } from "../domain/types";
import { createDocumentAction, deleteDocumentAction, duplicateDocumentAction } from "./actions";

export const NEW_DOCUMENT_TEXT = "Start from a preset; everything can be changed afterwards. A new document is private until you share it.";

export function NewDocumentButton({ workspaceId, presets }: { workspaceId: string; presets: { code: DocumentPreset; label: string; description: string }[] }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction();
  const router = useRouter();
  const create = async (preset: DocumentPreset) => {
    const r = await run(() => createDocumentAction({ workspaceId, preset }));
    if (r.ok) router.push(r.value.href);
  };
  return (
    <>
      <button type="button" className={primaryClass} data-testid="button-new-document" onClick={() => setOpen(true)}>
        New document
      </button>
      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent className="gap-0 border-im-line bg-im-surface text-[13px] text-im-ink sm:max-w-[520px]" data-testid="dialog-new-document">
            <DialogTitle className="text-base font-semibold">New document</DialogTitle>
            <p className="mt-3 text-im-ink-2">{NEW_DOCUMENT_TEXT}</p>
            <div className="mt-3 grid gap-2">
              {presets.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  disabled={pending}
                  data-testid={`button-preset-${p.code}`}
                  onClick={() => void create(p.code)}
                  className="rounded-lg border border-im-line bg-im-surface px-3 py-2 text-left hover:border-im-logical disabled:opacity-50"
                >
                  <b className="block font-semibold">{p.label}</b>
                  <span className="text-[12px] text-im-ink-2">{p.description}</span>
                </button>
              ))}
            </div>
            <DialogFooter className="mt-4">
              <button type="button" className={buttonClass} onClick={() => setOpen(false)} data-testid="button-cancel-new-document">
                Cancel
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export function RowActions({
  workspaceId,
  document: d,
  rights,
}: {
  workspaceId: string;
  document: { id: string; name: string; version: number };
  rights: { edit: boolean; duplicate: boolean; delete: boolean };
}) {
  const [asking, setAsking] = useState(false);
  const { run, saveRow, pending } = useAction();
  const duplicate = () => run(() => duplicateDocumentAction({ workspaceId, documentId: d.id }), (v) => DOCUMENT_TEXTS.duplicated(v.name));
  const remove = async () => {
    const r = await saveRow(d, (v) => deleteDocumentAction({ workspaceId, documentId: d.id, expectedVersion: v }), DOCUMENT_TEXTS.deleted, { deletes: true });
    if (r.ok) setAsking(false);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      <Link href={documentHref(workspaceId, d.id)} className={`${smallButtonClass} inline-flex items-center`} data-testid="button-document-open">
        {rights.edit ? "Edit" : "Open"}
      </Link>
      {rights.duplicate && (
        <button type="button" className={smallButtonClass} disabled={pending} onClick={() => void duplicate()} data-testid="button-document-duplicate">
          Duplicate
        </button>
      )}
      {rights.delete && (
        <button type="button" className={`${smallButtonClass} text-im-warn`} onClick={() => setAsking(true)} data-testid="button-document-delete">
          Delete
        </button>
      )}
      {asking && (
        <Dialog open onOpenChange={(o) => !o && setAsking(false)}>
          <DialogContent className="gap-0 border-im-line bg-im-surface text-[13px] text-im-ink sm:max-w-[440px]" data-testid="dialog-delete-document">
            <DialogTitle className="text-base font-semibold">Delete document</DialogTitle>
            <p className="mt-3" data-testid="text-delete-document">
              Delete <b>{d.name}</b>? It cannot be brought back.
            </p>
            <DialogFooter className="mt-4">
              <button type="button" className={buttonClass} onClick={() => setAsking(false)} data-testid="button-cancel-delete-document">
                Cancel
              </button>
              <button type="button" className={dangerClass} disabled={pending} onClick={() => void remove()} data-testid="button-confirm-delete-document">
                Delete
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
