import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDataStore } from "@/data";
import { signOut } from "./_actions/session";
import { workspaceHref } from "./_lib/paths";
import { LAST_WORKSPACE_COOKIE } from "./_lib/preferences";
import { requireSessionUser } from "./_lib/session";

// After sign-in: the last used workspace, else the first one (AD-07).
export default async function Landing() {
  const user = await requireSessionUser();
  const workspaces = await getDataStore().workspaces.listForUser(user.id);
  const last = (await cookies()).get(LAST_WORKSPACE_COOKIE)?.value;
  const target = workspaces.find((w) => w.id === last) ?? workspaces[0];
  if (target) redirect(workspaceHref(target.id));

  return (
    <main data-testid="page-no-workspace" className="flex flex-1 flex-col items-center justify-center gap-3">
      <h1 className="text-lg font-semibold">No workspace yet</h1>
      <p className="text-im-ink-2">{user.display_name}, you are not a member of any workspace.</p>
      <form action={signOut}>
        <button type="submit" data-testid="button-sign-out" className="rounded-md border px-3 py-1.5 hover:bg-im-hover">
          Sign out
        </button>
      </form>
    </main>
  );
}
