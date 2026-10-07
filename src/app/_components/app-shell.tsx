import type { ReactNode } from "react";
import { LookFrame } from "@/canvas/look";
import { CanvasTabs } from "@/app/w/[workspaceId]/p/[projectId]/_components/canvas-tabs";
import type { ProjectView } from "../_lib/project-view";
import type { ShellData } from "../_lib/shell";
import { Breadcrumbs } from "./breadcrumbs";
import { TopBar } from "./top-bar";

interface ProjectFrame {
  view: ProjectView;
  currentCanvasId: string | null;
  renameOnOpen?: boolean;
  /** Canvas tools for the top bar (zoom, fit), on canvas pages. */
  tools?: ReactNode;
  /** Panel contents on canvas pages; project pages show placeholders. */
  left?: ReactNode;
  right?: ReactNode;
  /** The status bar under the panels, on canvas pages. */
  status?: ReactNode;
}

/**
 * The page frame. Workspace pages: top bar, breadcrumbs, content. Project and canvas pages, as in the prototype:
 * left panel | canvas tabs, breadcrumbs and content | right panel. Canvas pages fill the panels.
 */
export function AppShell({ shell, project, children }: { shell: ShellData; project?: ProjectFrame; children: ReactNode }) {
  if (!project) {
    return (
      <div className="flex h-dvh min-h-0 flex-col bg-im-panel text-im-ink">
        <TopBar shell={shell} />
        <Breadcrumbs shell={shell} />
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    );
  }
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-im-panel text-im-ink">
      <TopBar shell={shell} tools={project.tools} />
      <div className="grid min-h-0 flex-1 grid-cols-[1fr] lg:grid-cols-[264px_1fr_340px]">
        <aside
          data-testid="panel-left"
          className="hidden min-h-0 flex-col overflow-hidden border-r border-im-line bg-im-panel lg:flex"
        >
          {project.left ?? <PanelPlaceholder>Model, sources and requirements arrive in a later slice.</PanelPlaceholder>}
        </aside>
        {/* The open canvas's background colours the tabs and the canvas (prototype #center[data-bg], slice 2a). */}
        <LookFrame className="flex min-h-0 min-w-0 flex-col">
          <CanvasTabs view={project.view} currentCanvasId={project.currentCanvasId} renameOnOpen={!!project.renameOnOpen} />
          <Breadcrumbs shell={shell} />
          <main className="relative min-h-0 flex-1 overflow-auto">{children}</main>
        </LookFrame>
        <aside
          data-testid="panel-inspector"
          className="hidden min-h-0 flex-col overflow-hidden border-l border-im-line bg-im-panel lg:flex"
        >
          {project.right ?? <PanelPlaceholder>Details of what you select appear here in a later slice.</PanelPlaceholder>}
        </aside>
      </div>
      {project.status}
    </div>
  );
}

const PanelPlaceholder = ({ children }: { children: ReactNode }) => (
  <div className="grid flex-1 place-items-center p-6 text-center text-xs text-im-ink-3">{children}</div>
);
