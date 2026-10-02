import { AppShell } from "@/app/_components/app-shell";
import { loadShell } from "@/app/_lib/shell";

// Workspace home. Overview, People and Settings arrive in step 5b.
export default async function WorkspaceHomePage({ params }: PageProps<"/w/[workspaceId]">) {
  const { workspaceId } = await params;
  const shell = await loadShell({ workspaceId });
  return (
    <AppShell shell={shell}>
      <div data-testid="page-workspace-home" className="mx-auto max-w-5xl px-6 py-6">
        <h1 className="m-0 text-2xl font-semibold">{shell.workspace.name}</h1>
      </div>
    </AppShell>
  );
}
