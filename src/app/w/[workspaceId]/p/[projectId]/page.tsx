import { AppShell } from "@/app/_components/app-shell";
import { loadProjectView } from "@/app/_lib/project-view";
import { loadShell } from "@/app/_lib/shell";
import { projectStats } from "@/app/_panels/stats";
import { getDataStore } from "@/data";
import { CanvasTiles } from "./_components/project-tiles";

// Project home (D-29): the project's canvases as tiles. Requirements, labels and open notes come with those slices.
export default async function ProjectHomePage({ params }: PageProps<"/w/[workspaceId]/p/[projectId]">) {
  const { workspaceId, projectId } = await params;
  const shell = await loadShell({ workspaceId, projectId });
  const view = await loadProjectView(shell);
  const n = view.canvases.length;
  const store = getDataStore();
  const [model, items] = await Promise.all([store.model.load(shell.workspace.id), store.canvasItems.list(shell.workspace.id)]);
  const st = projectStats(model, items, view.canvases.map((c) => c.id));

  return (
    <AppShell shell={shell} project={{ view, currentCanvasId: null }}>
      <div data-testid="page-project-home" className="min-h-full bg-im-canvas px-[clamp(16px,4vw,48px)] pb-12 pt-7">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-1 text-xs text-im-ink-3">Project</div>
          <h1 className="m-0 py-0.5 text-2xl font-semibold leading-tight">{view.project.name}</h1>
          {view.project.description && <p className="m-0 py-0.5 text-im-ink-2">{view.project.description}</p>}
          <div className="mb-1 mt-3.5 flex flex-wrap gap-2 [&>span]:rounded-[14px] [&>span]:bg-im-surface [&>span]:px-[11px] [&>span]:py-[3px] [&>span]:text-xs [&>span]:text-im-ink-2 [&>span]:shadow-[0_0_0_1px_var(--im-line)] [&_b]:font-semibold [&_b]:text-im-ink">
            <span>
              <b>{n}</b> canvas{n === 1 ? "" : "es"}
            </span>
            <span>
              <b>{st.entities}</b> entit{st.entities === 1 ? "y" : "ies"}
            </span>
            <span>
              <b>{st.sourceTables}</b> source table{st.sourceTables === 1 ? "" : "s"}
            </span>
            <span>
              <b>{st.mapped}</b> of <b>{st.attributes}</b> attributes mapped
            </span>
          </div>
          <h3 className="mb-2.5 mt-7 text-[13px] font-semibold text-im-ink-2">Canvases</h3>
          <CanvasTiles view={view} />
        </div>
      </div>
    </AppShell>
  );
}
