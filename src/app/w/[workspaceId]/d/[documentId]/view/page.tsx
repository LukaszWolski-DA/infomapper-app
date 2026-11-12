// A document's page (slice 25, step 4; F27, F28): built from its definition and the live model when opened, laid out in
// A4 pages in the browser; `?print=1` opens the print dialog once the pages are ready. In the app's shell, which print
// leaves out.

import { loadShell } from "@/app/_lib/shell";
import { DocumentViewPage } from "@/compose/documents-pages";

export default async function DocumentView({ params, searchParams }: PageProps<"/w/[workspaceId]/d/[documentId]/view">) {
  const { workspaceId, documentId } = await params;
  const query = await searchParams;
  const shell = await loadShell({ workspaceId, rest: `/d/${documentId}/view` });
  return <DocumentViewPage shell={shell} documentId={documentId} print={query.print === "1"} />;
}
