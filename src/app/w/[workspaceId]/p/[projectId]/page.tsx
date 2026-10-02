import { AppShell } from "@/app/_components/app-shell";
import { loadShell } from "@/app/_lib/shell";

// Project home. Canvas tiles arrive in step 5c.
export default async function ProjectHomePage({ params }: PageProps<"/w/[workspaceId]/p/[projectId]">) {
  const { workspaceId, projectId } = await params;
  const shell = await loadShell({ workspaceId, projectId });
  return (
    <AppShell shell={shell}>
      <div data-testid="page-project-home" className="mx-auto max-w-5xl px-6 py-6">
        <h1 className="m-0 text-2xl font-semibold">{shell.project?.name}</h1>
      </div>
    </AppShell>
  );
}
