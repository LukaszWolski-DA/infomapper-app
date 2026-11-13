// A document's editor (slice 26; slice 25's form before it, step 4, F27): InfoDocumenter's page, in the app's shell,
// through the composition root.

import { loadShell } from "@/app/_lib/shell";
import { DocumentEditorPage } from "@/compose/documents-pages";

export default async function DocumentEditor({ params }: PageProps<"/w/[workspaceId]/d/[documentId]">) {
  const { workspaceId, documentId } = await params;
  const shell = await loadShell({ workspaceId, rest: `/d/${documentId}` });
  return <DocumentEditorPage shell={shell} documentId={documentId} />;
}
