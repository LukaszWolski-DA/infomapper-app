// InfoDocumenter's two pages (slice 25, step 4; F27): the form (`/w/{ws}/d/{id}`) and the document
// (`/w/{ws}/d/{id}/view`), rendered inside the app's shell by their routes. Each checks the person may open the document
// (a shared one or their own, InfoDocumenter on; otherwise 404, F15). The document page makes one snapshot of the
// workspace (F1), builds the content tree on the server and renders it as React; only that HTML reaches the browser,
// never the model or another document.

import Link from "next/link";
import { notFound } from "next/navigation";
import { composedStore, DOCUMENT_SECTION_TYPES, DOCUMENT_TABLES, documentStateFor } from "@/app/_lib/documents";
import { loadAccess } from "@/app/_lib/model-command";
import { DOCUMENTATION_TAB, documentHref, workspaceHref } from "@/app/_lib/paths";
import { buildDocument } from "../domain/document";
import { documentRights } from "../domain/rights";
import { DocumentHtml } from "../ui/document-html";
import { documentCss } from "../ui/document-css";
import { DocumentForm, type FormSection } from "./form";
import { nameOf, openDocument } from "./load";
import { PagedView } from "./paged-view";

const backLink = (workspaceId: string) => (
  <Link href={workspaceHref(workspaceId, DOCUMENTATION_TAB)} data-testid="link-documentation" className="text-[12.5px] text-im-ink-2 hover:text-im-ink">
    ← Documentation
  </Link>
);

/** The day the live model is read, in the server's time zone: "Live model on {d}". */
const today = () => new Date().toLocaleDateString("sv-SE");

export async function DocumentFormBody({ workspaceId, documentId, userId }: { workspaceId: string; documentId: string; userId: string }) {
  const store = composedStore();
  const access = await loadAccess(store, workspaceId, userId);
  if (!access?.member) notFound();
  const doc = await openDocument(store, access, documentId);
  if (!doc) notFound();
  const [projects, model, people] = await Promise.all([store.projects.list(workspaceId), store.model.load(workspaceId), store.users.listForWorkspace(workspaceId)]);
  const rights = documentRights(access, doc);
  const sections: FormSection[] = doc.sections.map((s) => {
    const type = DOCUMENT_SECTION_TYPES.get(s.type);
    return {
      id: s.id,
      type: s.type,
      on: s.on,
      options: s.options,
      label: type ? type.label("en") : s.type,
      module: type?.module ?? null,
      known: !!type,
      available: !!type && type.available(access.workspace),
      checks: type?.optionChecks ?? null,
    };
  });
  return (
    <div className="min-h-full bg-im-canvas px-[clamp(16px,4vw,48px)] pb-12 pt-5" data-testid="page-document-form">
      <div className="mx-auto max-w-[860px]">
        {backLink(workspaceId)}
        <DocumentForm
          workspaceId={workspaceId}
          document={{ id: doc.id, version: doc.version, name: doc.name, audience: doc.audience, shared: doc.shared, scope: doc.scope, cover: doc.cover }}
          sections={sections}
          rights={rights}
          archived={access.workspace.archived_at !== null}
          author={nameOf(people, doc.author_id)}
          viewHref={documentHref(workspaceId, doc.id, true)}
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          concepts={model.concepts.map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>
    </div>
  );
}

export async function DocumentViewBody({
  workspaceId,
  documentId,
  userId,
  print,
  fontClassName,
}: {
  workspaceId: string;
  documentId: string;
  userId: string;
  print: boolean;
  fontClassName: string;
}) {
  const store = composedStore();
  const access = await loadAccess(store, workspaceId, userId);
  if (!access?.member) notFound();
  const doc = await openDocument(store, access, documentId);
  if (!doc) notFound();
  const snapshot = await store.snapshot(workspaceId, DOCUMENT_TABLES);
  if (!snapshot) notFound();
  const tree = buildDocument({ definition: doc, state: documentStateFor(snapshot), types: DOCUMENT_SECTION_TYPES, date: today() });
  const sourceId = `document-source-${doc.id}`;
  return (
    <div className={`min-h-full bg-im-canvas px-[clamp(16px,4vw,48px)] pb-12 pt-5 ${fontClassName}`} data-testid="page-document-view">
      <div className="mx-auto max-w-[900px]">
        <div className="mb-3 flex flex-wrap items-center gap-3 print:hidden">
          {backLink(workspaceId)}
          <h1 className="m-0 text-[15px] font-semibold" data-testid="text-document-name">
            {doc.name}
          </h1>
          <Link href={documentHref(workspaceId, doc.id)} data-testid="link-document-form" className="text-[12.5px] text-im-ink-2 hover:text-im-ink">
            {documentRights(access, doc).edit ? "Edit" : "Open"} the recipe
          </Link>
        </div>
        <div hidden id={sourceId}>
          <DocumentHtml tree={tree} />
        </div>
        <PagedView sourceId={sourceId} css={documentCss(tree.frame)} print={print} />
      </div>
    </div>
  );
}
