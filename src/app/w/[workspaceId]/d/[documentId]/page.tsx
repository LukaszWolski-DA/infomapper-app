// A document's form (slice 25, step 4; F27): InfoDocumenter's page, in the app's shell, through the composition root.

import { loadShell } from "@/app/_lib/shell";
import { DocumentFormPage } from "@/compose/documents-pages";

export default async function DocumentForm({ params }: PageProps<"/w/[workspaceId]/d/[documentId]">) {
  const { workspaceId, documentId } = await params;
  const shell = await loadShell({ workspaceId, rest: `/d/${documentId}` });
  return <DocumentFormPage shell={shell} documentId={documentId} />;
}
