import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { parseSidePanelsCookie, sidePanelsCookieName } from "@/ui/side-panels-cookie";
import { LookFrame } from "@/canvas/look";
import { CanvasTabs } from "@/app/w/[workspaceId]/p/[projectId]/_components/canvas-tabs";
import type { ProjectView } from "../_lib/project-view";
import type { ShellData } from "../_lib/shell";
import { Breadcrumbs, type Trail } from "./breadcrumbs";
import { SidePanelsGrid, SidePanelsProvider } from "./side-panels";
import { TopBar } from "./top-bar";

interface ProjectFrame {
  view: ProjectView;
  currentCanvasId: string | null;
  renameOnOpen?: boolean;
  /** Tools for the top bar: the working context and Undo and Redo on canvas pages, Undo and Redo on the project home (slice 12a). */
  tools?: ReactNode;
  /** The canvas toolbar over the canvas's area, on canvas pages (slice 38): before the page's content, so it comes after the navigation row in Tab order. */
  canvasTools?: ReactNode;
  /** Panel contents on canvas pages; project pages show placeholders. */
  left?: ReactNode;
  right?: ReactNode;
  /** The view-state bar at the right end of the breadcrumbs row, on canvas pages (slice 6a). */
  viewState?: ReactNode;
  /** The status bar under the panels, on canvas pages. */
  status?: ReactNode;
  /** The page was opened to show something's details: a hidden right panel opens (slice 5a, Q4). */
  openDetails?: boolean;
  /**
   * A page, not a canvas (slice 38, S38-03, B4): the project home. The canvas tabs and the navigation row as on a canvas
   * page, but no side panels, no panels' toggles, and the panels' cookie neither read nor written.
   */
  page?: boolean;
}

/**
 * The page frame. Workspace pages: top bar, breadcrumbs, content. The project home (slice 38): top bar, canvas tabs,
 * breadcrumbs, content, no side panels. Canvas pages, as in the prototype:
 * left panel | canvas tabs, breadcrumbs and content | right panel. Canvas pages fill the panels. The panels show, hide
 * and slide over the canvas on narrow screens as `SidePanelsProvider` (around the page) says (slice 5a).
 */
export async function AppShell({
  shell,
  project,
  tools,
  trail,
  savePair = true,
  children,
}: {
  shell: ShellData;
  project?: ProjectFrame;
  /** The top bar's tools on workspace pages: Undo and Redo on the workspace home (slice 12a). */
  tools?: ReactNode;
  /** A workspace page's breadcrumbs after the workspace (slice 25's document pages); else "Workspace home". */
  trail?: Trail;
  /** The top bar's save indicator and badge (slice 30); off where the page draws them in its own bar (F16). */
  savePair?: boolean;
  children: ReactNode;
}) {
  if (!project) {
    return (
      <div className="flex h-dvh min-h-0 flex-col bg-im-panel text-im-ink">
        <TopBar shell={shell} tools={tools} savePair={savePair} />
        <Breadcrumbs shell={shell} trail={trail} />
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    );
  }
  if (project.page) {
    return (
      <div className="flex h-dvh min-h-0 flex-col bg-im-panel text-im-ink">
        <TopBar shell={shell} tools={project.tools} />
        <LookFrame className="flex min-h-0 min-w-0 flex-1 flex-col">
          <CanvasTabs view={project.view} currentCanvasId={project.currentCanvasId} renameOnOpen={!!project.renameOnOpen} />
          <Breadcrumbs shell={shell}>{project.viewState}</Breadcrumbs>
          <main className="relative min-h-0 flex-1 overflow-auto">{children}</main>
        </LookFrame>
      </div>
    );
  }
  const panels = parseSidePanelsCookie((await cookies()).get(sidePanelsCookieName(shell.user.id))?.value);
  return (
    <SidePanelsProvider userId={shell.user.id} initial={panels} openRight={!!project.openDetails}>
    <div className="flex h-dvh min-h-0 flex-col bg-im-panel text-im-ink">
      <TopBar shell={shell} tools={project.tools} panelToggles />
      <SidePanelsGrid
        left={project.left ?? <PanelPlaceholder>Open a canvas to work with the model, sources and requirements.</PanelPlaceholder>}
        right={project.right ?? <PanelPlaceholder>Open a canvas to see the details of what you select.</PanelPlaceholder>}
      >
        {/* The open canvas's background colours the tabs and the canvas (prototype #center[data-bg], slice 2a). */}
        <LookFrame className="flex min-h-0 min-w-0 flex-col">
          <CanvasTabs view={project.view} currentCanvasId={project.currentCanvasId} renameOnOpen={!!project.renameOnOpen} />
          <Breadcrumbs shell={shell}>{project.viewState}</Breadcrumbs>
          <main className="relative min-h-0 flex-1 overflow-auto">
            {project.canvasTools}
            {children}
          </main>
        </LookFrame>
      </SidePanelsGrid>
      {project.status}
    </div>
    </SidePanelsProvider>
  );
}

const PanelPlaceholder = ({ children }: { children: ReactNode }) => (
  <div className="grid flex-1 place-items-center p-6 text-center text-xs text-im-ink-3">{children}</div>
);
