import { AppShell } from "@/app/_components/app-shell";
import { loadShell } from "@/app/_lib/shell";

// Canvas page. Tabs and the empty canvas arrive in step 5c.
export default async function CanvasPage({ params }: PageProps<"/w/[workspaceId]/p/[projectId]/c/[canvasId]">) {
  const { workspaceId, projectId, canvasId } = await params;
  const shell = await loadShell({ workspaceId, projectId, canvasId });
  return (
    <AppShell shell={shell}>
      <div data-testid="page-canvas" className="px-6 py-6">
        <h1 className="m-0 text-2xl font-semibold">{shell.canvas?.name}</h1>
      </div>
    </AppShell>
  );
}
