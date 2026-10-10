import { AppShell } from "@/app/_components/app-shell";
import { loadProjectView } from "@/app/_lib/project-view";
import { loadShell } from "@/app/_lib/shell";
import { projectStats } from "@/app/_panels/stats";
import { canvasHref } from "@/app/_lib/paths";
import { getDataStore } from "@/data";
import type { Uuid } from "@/domain/ids";
import { projectLabels, type ProjectLabelContext } from "@/domain/model/labels";
import type { CanvasItem, WorkspaceModel } from "@/domain/types";
import { ProjectLabels } from "./_components/project-labels";
import { CanvasTiles } from "./_components/project-tiles";

/** What `projectLabels` needs to know about the cards on some canvases. */
function labelContext(model: WorkspaceModel, items: readonly CanvasItem[]): ProjectLabelContext {
  const mappingEnds = new Map<Uuid, { attributeId: Uuid; columnIds: Uuid[] }>(model.mappings.map((m) => [m.id, { attributeId: m.attribute_id, columnIds: [] }]));
  for (const i of model.mappingInputs) mappingEnds.get(i.mapping_id)?.columnIds.push(i.source_column_id);
  return {
    entitiesHere: new Set(items.flatMap((i) => (i.entity_id ? [i.entity_id] : []))),
    tablesHere: new Set(items.flatMap((i) => (i.source_table_id ? [i.source_table_id] : []))),
    entityOfAttribute: new Map(model.attributes.map((a) => [a.id, a.entity_id])),
    tableOfColumn: new Map(model.sourceColumns.map((c) => [c.id, c.source_table_id])),
    mappingEnds,
  };
}

// Project home (D-29): the project's canvases as tiles; the labels used on them and pinned to the project (slice 3a).
// Requirements and open notes come with those slices.
export default async function ProjectHomePage({ params }: PageProps<"/w/[workspaceId]/p/[projectId]">) {
  const { workspaceId, projectId } = await params;
  const shell = await loadShell({ workspaceId, projectId });
  const view = await loadProjectView(shell);
  const n = view.canvases.length;
  const store = getDataStore();
  const ws = shell.workspace.id;
  const [model, items, labels, links, pins] = await Promise.all([
    store.model.load(ws),
    store.canvasItems.list(ws),
    store.labels.list(ws),
    store.labels.listLinks(ws),
    store.labels.listPins(ws),
  ]);
  const st = projectStats(model, items, view.canvases.map((c) => c.id));

  // Labels: pinned first, then by items; each opens on the first canvas (tab order) where it marks something.
  const pinned = new Set(pins.filter((p) => p.project_id === view.project.id).map((p) => p.label_id));
  const itemsOf = (canvasIds: readonly Uuid[]) => items.filter((i) => canvasIds.includes(i.canvas_id));
  const rows = projectLabels(labels, links, pinned, labelContext(model, itemsOf(view.canvases.map((c) => c.id))));
  const usedOn = view.canvases.map((c) => ({ id: c.id, labels: new Set(projectLabels(labels, links, new Set(), labelContext(model, itemsOf([c.id]))).map((r) => r.label.id)) }));
  const projectLabelRows = rows.map(({ label, items: count, pinned: isPinned }) => {
    const canvasId = usedOn.find((c) => c.labels.has(label.id))?.id ?? view.canvases[0]!.id;
    return { id: label.id, name: label.name, items: count, pinned: isPinned, href: `${canvasHref(ws, view.project.id, canvasId)}?label=${label.id}` };
  });

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
          <h3 className="mb-2.5 mt-7 text-[13px] font-semibold text-im-ink-2">Labels in this project</h3>
          <ProjectLabels workspaceId={ws} projectId={view.project.id} labels={projectLabelRows} editable={shell.standing === "full"} />
        </div>
      </div>
    </AppShell>
  );
}
