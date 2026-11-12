// A document's page (slice 25, step 4; F27, F28): built from its definition and the live model when opened, laid out in
// A4 pages in the browser; `?print=1` opens the print dialog once the pages are ready. In the app's shell, which print
// leaves out; IBM Plex Serif is loaded here only.

import { AppShell } from "@/app/_components/app-shell";
import { plexSerif } from "@/app/fonts/plex-serif";
import { loadShell } from "@/app/_lib/shell";
import { DocumentViewBody } from "@/compose/documents-pages";

export default async function DocumentViewPage({ params, searchParams }: PageProps<"/w/[workspaceId]/d/[documentId]/view">) {
  const { workspaceId, documentId } = await params;
  const query = await searchParams;
  const shell = await loadShell({ workspaceId, rest: `/d/${documentId}/view` });
  return (
    <AppShell shell={shell}>
      <DocumentViewBody workspaceId={workspaceId} documentId={documentId} userId={shell.user.id} print={query.print === "1"} fontClassName={plexSerif.variable} />
    </AppShell>
  );
}
