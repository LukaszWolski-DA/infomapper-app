// InfoDocumenter's two pages (slice 25, step 4; F27): the editor (`/w/{ws}/d/{id}`, slice 26: it replaced the form)
// and the document (`/w/{ws}/d/{id}/view`), each in the app's shell with the breadcrumbs "{workspace} › Documentation › {document}"
// (step 4b). Each checks the person may open the document (a shared one or their own, InfoDocumenter on); a document
// they can no longer open, or never could, returns to the Documentation tab with "This document is no longer available
// to you." (step 4b), never a 404 and never "forbidden" (F15). The document page makes one snapshot of the workspace
// (F1), builds the content tree on the server and renders it as React; only that HTML reaches the browser, never the
// model or another document. The editor (slice 26, D7) reads its snapshot once from the browser (`documentSnapshotAction`)
// and builds the tree there: the model a member sees on the canvas pages anyway, never another document.

import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/app/_components/app-shell";
import { plexSerif } from "@/app/fonts/plex-serif";
import { composedStore, dimensionalLevelOn, DOCUMENT_SECTION_TYPES, DOCUMENT_TABLES, documentStateFor } from "@/app/_lib/documents";
import { classificationIndex, isBuiltin, isDataVault } from "@/domain/model/classifications";
import { registerKey } from "../domain/sections-sources";
import { loadAccess } from "@/app/_lib/model-command";
import { DOCUMENTATION_TAB, documentHref, workspaceHref } from "@/app/_lib/paths";
import type { ShellData } from "@/app/_lib/shell";
import type { WorkspaceAccess } from "@/domain/permissions";
import { buildDocument } from "../domain/document";
import { documentRights } from "../domain/rights";
import type { DocumentDefinition } from "../domain/types";
import { DocumentHtml } from "../ui/document-html";
import { documentCss } from "../ui/document-css";
import { areTestHooksOn } from "@/data/local/measure-mode";
import { DocumentEditor, type EditorSectionType } from "./editor";
import { GONE_DOCUMENT, nameOf, openDocument } from "./load";
import { PagedView } from "./paged-view";


const tabHref = (workspaceId: string) => workspaceHref(workspaceId, DOCUMENTATION_TAB);

/** The document the person may open, with the access it was checked with; otherwise back to the tab with the toast. */
async function documentOrBack(workspaceId: string, documentId: string, userId: string): Promise<{ access: WorkspaceAccess; doc: DocumentDefinition }> {
  const store = composedStore();
  const access = await loadAccess(store, workspaceId, userId);
  const doc = access?.member ? await openDocument(store, access, documentId) : null;
  if (!access || !doc) redirect(`${tabHref(workspaceId)}&gone=${GONE_DOCUMENT}`);
  return { access, doc };
}

const trail = (workspaceId: string, doc: DocumentDefinition, view: boolean) => [
  { label: "Documentation", href: tabHref(workspaceId) },
  { label: doc.name, href: documentHref(workspaceId, doc.id, view) },
];

const backLink = (workspaceId: string) => (
  <Link href={tabHref(workspaceId)} data-testid="link-documentation" className="text-[12.5px] text-im-ink-2 hover:text-im-ink">
    ← Documentation
  </Link>
);

/** The day the live model is read, in the server's time zone: "Live model on {d}". */
const today = () => new Date().toLocaleDateString("sv-SE");

export async function DocumentEditorPage({ shell, documentId }: { shell: ShellData; documentId: string }) {
  const workspaceId = shell.workspace.id;
  const { access, doc } = await documentOrBack(workspaceId, documentId, shell.user.id);
  const store = composedStore();
  const [projects, model, people, authorMember] = await Promise.all([
    store.projects.list(workspaceId),
    store.model.load(workspaceId),
    store.users.listForWorkspace(workspaceId),
    store.workspaces.getMember(workspaceId, doc.author_id),
  ]);
  const language = doc.style.language ?? access.workspace.doc_language;
  // every registered type, in their order: InfoDocumenter's, then the modules' (the prototype's "+ Add section")
  const types: EditorSectionType[] = [...DOCUMENT_SECTION_TYPES.values()].map((t) => ({
    type: t.type,
    name: t.label("en"),
    description: t.description ?? "",
    module: t.module,
    available: t.available(access.workspace),
    heading: t.label(language),
    checks: t.optionChecks ?? null,
    note: t.optionNote ?? null,
  }));
  // the register's choices: the workspace's live classifications in list order, a built-in one by its code (Data Vault
  // ones only in Data Vault 2.0 mode)
  const classifications = classificationIndex(model.classifications, model.classificationLinks)
    .list.filter((c) => !isDataVault(c) || access.workspace.dv2_mode)
    .map((c) => ({ key: registerKey(c), name: c.name, scope: c.scope, own: !isBuiltin(c) }));
  return (
    <AppShell shell={shell} trail={trail(workspaceId, doc, false)}>
      {/* the Formal template's serif, on this page only (slice 26, step 4) */}
      <div className={`${plexSerif.variable} h-full`}>
        <DocumentEditor
          workspaceId={workspaceId}
          document={{
            id: doc.id,
            version: doc.version,
            name: doc.name,
            audience: doc.audience,
            shared: doc.shared,
            scope: doc.scope,
            cover: doc.cover,
            style: doc.style,
            sections: doc.sections,
            author_id: doc.author_id,
          }}
          types={types}
          rights={documentRights(access, doc)}
          archived={access.workspace.archived_at !== null}
          author={nameOf(people, doc.author_id)}
          authorMember={authorMember !== null}
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          concepts={model.concepts.map((c) => ({ id: c.id, name: c.name }))}
          date={today()}
          testHooks={areTestHooksOn()}
          dimensional={dimensionalLevelOn(access.workspace)}
          workspaceLanguage={access.workspace.doc_language}
          optionContext={{ dataVault: access.workspace.dv2_mode, hasNaming: !!access.workspace.naming_conventions?.trim(), classifications }}
        />
      </div>
    </AppShell>
  );
}

export async function DocumentViewPage({ shell, documentId, print }: { shell: ShellData; documentId: string; print: boolean }) {
  const workspaceId = shell.workspace.id;
  const { access, doc } = await documentOrBack(workspaceId, documentId, shell.user.id);
  const snapshot = await composedStore().snapshot(workspaceId, DOCUMENT_TABLES);
  if (!snapshot) redirect(`${tabHref(workspaceId)}&gone=${GONE_DOCUMENT}`);
  const tree = buildDocument({ definition: doc, state: documentStateFor(snapshot), types: DOCUMENT_SECTION_TYPES, date: today() });
  const sourceId = `document-source-${doc.id}`;
  return (
    <AppShell shell={shell} trail={trail(workspaceId, doc, true)}>
      <div className={`${plexSerif.variable} min-h-full bg-im-canvas px-[clamp(16px,4vw,48px)] pb-12 pt-5`} data-testid="page-document-view">
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
          <PagedView sourceId={sourceId} css={documentCss(tree.frame, tree.style)} print={print} />
        </div>
      </div>
    </AppShell>
  );
}
