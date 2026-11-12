// A document's form (slice 25, step 4; F27): in the app's shell; InfoDocumenter's page body through the composition root.

import { AppShell } from "@/app/_components/app-shell";
import { loadShell } from "@/app/_lib/shell";
import { DocumentFormBody } from "@/compose/documents-pages";

export default async function DocumentFormPage({ params }: PageProps<"/w/[workspaceId]/d/[documentId]">) {
  const { workspaceId, documentId } = await params;
  const shell = await loadShell({ workspaceId, rest: `/d/${documentId}` });
  return (
    <AppShell shell={shell}>
      <DocumentFormBody workspaceId={workspaceId} documentId={documentId} userId={shell.user.id} />
    </AppShell>
  );
}
