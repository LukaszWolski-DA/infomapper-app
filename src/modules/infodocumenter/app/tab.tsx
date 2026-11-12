// The workspace home's Documentation tab (slice 25, step 4; PRD section 2, D10): an introduction, New document, then
// the shared documents and the person's own private ones, each with its name, meta line and buttons. Another's private
// document never reaches the page (filtered on the server, F15). The count is the documents the person sees.

import Link from "next/link";
import type { ReactNode } from "react";
import { documentHref } from "@/app/_lib/paths";
import type { DocLanguage } from "@/domain/types";
import { DOC_LANGUAGE_OPTIONS } from "@/ui/doc-languages";
import { PRESETS } from "../domain/presets";
import type { DocumentListRow } from "./load";
import { NewDocumentButton, RowActions } from "./tab-actions";

export const TAB_TEXTS = {
  label: (n: number) => `Documentation (${n})`,
  shared: "Shared documents",
  private: "Your private documents",
  noneShared: "None yet.",
  noneSharedMay: "Open a document and set it to Shared.",
  nonePrivate: "None. Private documents are seen only by their author, so readers and guests can make their own.",
} as const;

const languageName = (l: DocLanguage) => DOC_LANGUAGE_OPTIONS.find(([code]) => code === l)?.[1] ?? l;

/** "{audience} · live model · {n} sections · {language} · A4 · by {author}" ("by …" for shared ones only). */
export const metaLine = (d: Pick<DocumentListRow, "audience" | "sections" | "shared" | "author">, language: DocLanguage): string =>
  [d.audience, "live model", `${d.sections} section${d.sections === 1 ? "" : "s"}`, languageName(language), "A4", d.shared ? `by ${d.author}` : null].filter(Boolean).join(" · ");

export function DocumentationTab({
  workspaceId,
  language,
  documents,
  canCreate,
  canShare,
}: {
  workspaceId: string;
  language: DocLanguage;
  documents: DocumentListRow[];
  canCreate: boolean;
  canShare: boolean;
}) {
  const shared = documents.filter((d) => d.shared);
  const mine = documents.filter((d) => !d.shared);
  const row = (d: DocumentListRow) => (
    <div
      key={d.id}
      data-testid="row-document"
      data-name={d.name}
      className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-im-surface px-3.5 py-2.5 shadow-[0_0_0_1px_var(--im-line)]"
    >
      <div className="min-w-0">
        <Link href={documentHref(workspaceId, d.id)} className="font-semibold text-im-ink hover:underline" data-testid="link-document-name">
          {d.name}
        </Link>
        <div className="text-[11.5px] text-im-ink-3" data-testid="text-document-meta">
          {metaLine(d, language)}
        </div>
      </div>
      <RowActions workspaceId={workspaceId} document={{ id: d.id, name: d.name, version: d.version }} rights={d.rights} />
    </div>
  );
  return (
    <div data-testid="tab-body-docs">
      <div className="mt-3.5 flex flex-wrap items-start justify-between gap-3">
        <p className="m-0 max-w-[720px] text-im-ink-2" data-testid="text-documentation-intro">
          Documents are generated from the model: their tables come from its objects, so a document is right at the moment it is opened. A{" "}
          <b>document</b> is the recipe; print it to make a PDF.
        </p>
        {canCreate && <NewDocumentButton workspaceId={workspaceId} presets={PRESETS.map((p) => ({ code: p.code, label: p.label, description: p.description }))} />}
      </div>
      <H3>{TAB_TEXTS.shared}</H3>
      <div data-testid="list-shared-documents">
        {shared.length ? shared.map(row) : <Empty>{`${TAB_TEXTS.noneShared}${canShare ? ` ${TAB_TEXTS.noneSharedMay}` : ""}`}</Empty>}
      </div>
      <H3>{TAB_TEXTS.private}</H3>
      <div data-testid="list-private-documents">{mine.length ? mine.map(row) : <Empty>{TAB_TEXTS.nonePrivate}</Empty>}</div>
    </div>
  );
}

const H3 = ({ children }: { children: ReactNode }) => <h3 className="mb-2.5 mt-[26px] text-[13px] font-semibold text-im-ink-2">{children}</h3>;
const Empty = ({ children }: { children: ReactNode }) => (
  <p className="m-0 text-im-ink-3" data-testid="text-documents-empty">
    {children}
  </p>
);
