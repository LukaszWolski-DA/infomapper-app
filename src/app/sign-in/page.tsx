import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDataStore } from "@/data";
import { isUuid } from "@/domain/ids";
import { signInAsDevUser } from "../_actions/session";
import { isDevSignInEnabled } from "../_lib/dev-session";
import { getSession } from "../_lib/session";
import { CreateOrganizationForm, OrganizationLinkForm, SignInSteps } from "./start-forms";

export const metadata: Metadata = { title: "Sign in · InfoMapper" };

/**
 * The start page (slice 8, D-58): "Sign in" and "Create an organization" side by side, or, with `?org=`, the
 * organization's link form (also where a locked organization's pages send, with `next`). Below them, in development
 * only, the list of test users as before.
 */
export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  // Decided per request, not at build time: the measurement-only build (AD-31) is built like a normal production build
  // and only differs in how it is started.
  await connection();
  if (!isDevSignInEnabled()) notFound();

  const store = getDataStore();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);
  const orgId = one(params.org);
  const organization = isUuid(orgId) ? await store.organizations.get(orgId) : null;
  const next = one(params.next);
  // a locked organization's form has the signed-in person's e-mail filled in (item 4); nothing personal in the address
  const email = organization ? ((await getSession())?.user.email ?? "") : "";
  const users = await store.users.list();
  const people = await Promise.all(
    users.map(async (user) => {
      const organizations = await store.organizations.listForUser(user.id);
      const memberships = await store.organizations.listMembershipsOfUsers([user.id]);
      return {
        user,
        organizations: organizations.map((o) => ({
          name: o.name,
          guest: !memberships.some((m) => m.organization_id === o.id),
        })),
      };
    }),
  );

  return (
    <main data-testid="page-sign-in" className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-lg font-semibold">InfoMapper</h1>
      {organization ? (
        <div className="w-full max-w-md">
          <OrganizationLinkForm organization={{ id: organization.id, name: organization.name }} email={email} next={next} />
        </div>
      ) : (
        <div className="flex w-full max-w-3xl flex-col items-start gap-4 md:flex-row">
          <SignInSteps next={next} />
          <CreateOrganizationForm />
        </div>
      )}
      <div
        data-testid="banner-dev-sign-in"
        role="status"
        className="w-full max-w-md rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-amber-900"
      >
        <b className="font-semibold">Development sign-in.</b> Pick a test user. This page does not exist in production.
      </div>
      <div className="w-full max-w-md">
        <h2 className="mb-1 text-[15px] font-semibold">Sign in as a test user</h2>
        <p className="mb-4 text-muted-foreground">Choose who you want to be.</p>
        <ul className="divide-y rounded-md border" data-testid="list-dev-users">
          {people.map(({ user, organizations }) => (
            <li key={user.id}>
              <form action={signInAsDevUser}>
                <input type="hidden" name="userId" value={user.id} />
                <button
                  type="submit"
                  data-testid="button-dev-user"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted font-medium">
                    {initials(user.display_name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{user.display_name}</span>
                    <span className="block truncate text-muted-foreground">
                      {user.email} ·{" "}
                      {organizations.map((o) => (o.guest ? `${o.name} (guest)` : o.name)).join(", ") || "no organization"}
                    </span>
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
