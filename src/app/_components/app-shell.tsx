import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { parseSidePanelsCookie, sidePanelsCookieName } from "@/ui/side-panels-cookie";
import { LookFrame } from "@/canvas/look";
import { CanvasTabs } from "@/app/w/[workspaceId]/p/[projectId]/_components/canvas-tabs";
import type { ProjectView } from "../_lib/project-view";
import type { ShellData } from "../_lib/shell";
import { Breadcrumbs } from "./breadcrumbs";
import { SidePanelsGrid, SidePanelsProvider } from "./side-panels";
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
  /** The view-state bar at the right end of the breadcrumbs row, on canvas pages (slice 6a). */
  viewState?: ReactNode;
  /** The status bar under the panels, on canvas pages. */
  status?: ReactNode;
  /** The page was opened to show something's details: a hidden right panel opens (slice 5a, Q4). */
  openDetails?: boolean;
}

/**
 * The page frame. Workspace pages: top bar, breadcrumbs, content. Project and canvas pages, as in the prototype:
 * left panel | canvas tabs, breadcrumbs and content | right panel. Canvas pages fill the panels. The panels show, hide
 * and slide over the canvas on narrow screens as `SidePanelsProvider` (around the page) says (slice 5a).
 */
export async function AppShell({ shell, project, children }: { shell: ShellData; project?: ProjectFrame; children: ReactNode }) {
  if (!project) {
    return (
      <div className="flex h-dvh min-h-0 flex-col bg-im-panel text-im-ink">
        <TopBar shell={shell} />
        <Breadcrumbs shell={shell} />
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
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
          <main className="relative min-h-0 flex-1 overflow-auto">{children}</main>
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
