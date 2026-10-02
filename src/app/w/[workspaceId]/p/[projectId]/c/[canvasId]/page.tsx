import { AppShell } from "@/app/_components/app-shell";
import { loadProjectView } from "@/app/_lib/project-view";
import { loadShell } from "@/app/_lib/shell";

// Canvas page: tabs, empty panels and an empty canvas area. The canvas engine is still open (AD-24).
export default async function CanvasPage({
  params,
  searchParams,
}: PageProps<"/w/[workspaceId]/p/[projectId]/c/[canvasId]">) {
  const { workspaceId, projectId, canvasId } = await params;
  const renameOnOpen = (await searchParams).rename === "1";
  const shell = await loadShell({ workspaceId, projectId, canvasId });
  const view = await loadProjectView(shell);

  return (
    <AppShell shell={shell} project={{ view, currentCanvasId: canvasId, renameOnOpen }}>
      <section
        aria-label="Model canvas"
        data-testid="area-canvas"
        className="absolute inset-0 grid place-items-center overflow-hidden bg-im-canvas bg-[radial-gradient(var(--im-grid)_1px,transparent_1.2px)] bg-[length:20px_20px] text-center text-im-ink-3"
      >
        <div>
          <b className="mb-1 block text-[15px] font-medium text-im-ink-2">The canvas is empty</b>
          The canvas arrives in slice 1.
        </div>
      </section>
    </AppShell>
  );
}
