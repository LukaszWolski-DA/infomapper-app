import { signOut } from "./_actions/session";
import { requireSessionUser } from "./_lib/session";

// Placeholder until the shell arrives in slice 0, step 5 (it will go to the last used workspace, AD-07).
export default async function Home() {
  const user = await requireSessionUser();
  return (
    <main data-testid="page-home" className="flex flex-1 flex-col items-center justify-center gap-3">
      <h1 className="text-lg font-semibold">InfoMapper</h1>
      <p data-testid="text-signed-in-as">Signed in as {user.display_name}</p>
      <form action={signOut}>
        <button type="submit" data-testid="button-sign-out" className="rounded-md border px-3 py-1.5 hover:bg-muted">
          Sign out
        </button>
      </form>
    </main>
  );
}
