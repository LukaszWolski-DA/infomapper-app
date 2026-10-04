import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/app/_components/app-shell";
import { projectHref, workspaceHref } from "@/app/_lib/paths";
import { ROLE_LABEL } from "@/app/_lib/roles";
import { loadShell } from "@/app/_lib/shell";
import { workspaceStats } from "@/app/_panels/stats";
import { getDataStore } from "@/data";
import { can } from "@/domain/permissions";
import { ArchiveBox, UnarchiveButton } from "./_components/lifecycle";
import { NewProjectTile } from "./_components/new-project-tile";
import { SettingsForm } from "./_components/settings-form";

const TABS = ["overview", "people", "settings"] as const;
type Tab = (typeof TABS)[number];

export default async function WorkspaceHomePage({ params, searchParams }: PageProps<"/w/[workspaceId]">) {
  const { workspaceId } = await params;
  const tabParam = (await searchParams).tab;
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "overview";

  const shell = await loadShell({ workspaceId });
  const store = getDataStore();
  const workspace = (await store.workspaces.get(workspaceId))!;
  const [members, users, projects, model] = await Promise.all([
    store.workspaces.listMembers(workspaceId),
    store.users.list(),
    store.projects.list(workspaceId),
    store.model.load(workspaceId),
  ]);
  const orgMemberships = await store.organizations.listMembershipsOfUsers(members.map((m) => m.user_id));
  const organizations = await Promise.all(
    [...new Set(orgMemberships.map((m) => m.organization_id))].map((id) => store.organizations.get(id)),
  );
  const orgName = (id: string) => organizations.find((o) => o?.id === id)?.name ?? "";

  const access = { workspace, member: members.find((m) => m.user_id === shell.user.id) ?? null };
  const archived = shell.workspace.archived;
  const isOwner = shell.role === "owner";
  const isAdmin = isOwner || shell.role === "admin";
  const roleLabel = ROLE_LABEL[shell.role] + (shell.guest ? " · guest" : "");

  const people = members.map((m) => {
    const user = users.find((u) => u.id === m.user_id)!;
    const homes = orgMemberships.filter((o) => o.user_id === m.user_id);
    const guest = !homes.some((o) => o.organization_id === workspace.organization_id);
    return { user, role: m.role, guestFrom: guest ? homes.map((o) => orgName(o.organization_id)).join(", ") : null };
  });

  const stats = workspaceStats(model);
  const counts = new Map(shell.projects.map((p) => [p.id, p.canvasCount]));

  return (
    <AppShell shell={shell}>
      <div data-testid="page-workspace-home" className="min-h-full bg-im-canvas px-[clamp(16px,4vw,48px)] pb-12 pt-6">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-1 text-xs text-im-ink-3">{shell.organization.name} · workspace</div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="m-0 text-2xl font-semibold">{workspace.name}</h1>
            {archived && <Badge className="bg-im-warn-soft text-im-warn" testId="badge-archived">Archived · read-only</Badge>}
            {workspace.dv2_mode && <Badge className="bg-im-req-soft text-im-req-ink">Data Vault 2.0 mode</Badge>}
            <Badge>{roleLabel}</Badge>
          </div>
          <div className="mt-1 text-im-ink-2">
            {workspace.client_name ? `Client: ${workspace.client_name}. ` : ""}
            {workspace.description ?? ""}
          </div>

          {archived ? (
            <Banner tone="warn" testId="banner-archived">
              This workspace is archived. Everything is read-only.
              {isOwner && (
                <UnarchiveButton workspaceId={workspace.id} workspaceName={workspace.name} version={workspace.version} />
              )}
            </Banner>
          ) : shell.standing !== "full" ? (
            <Banner tone="info" testId="banner-role">
              You are a {shell.role} here:{" "}
              {shell.standing === "review"
                ? "you can approve mappings and requirements and add notes, but not edit the model."
                : "read-only."}
            </Banner>
          ) : null}

          <div role="tablist" className="mb-1 mt-4 flex gap-0.5 border-b border-im-line">
            {(
              [
                ["overview", "Overview"],
                ["people", `People (${members.length})`],
                ["settings", "Settings"],
              ] as const
            ).map(([key, label]) => (
              <Link
                key={key}
                role="tab"
                aria-selected={tab === key}
                data-testid={`tab-${key}`}
                href={workspaceHref(workspace.id, key === "overview" ? undefined : key)}
                className={
                  "-mb-px border-b-2 px-3.5 py-2 font-medium " +
                  (tab === key ? "border-im-logical text-im-ink" : "border-transparent text-im-ink-2 hover:text-im-ink")
                }
              >
                {label}
              </Link>
            ))}
          </div>

          {tab === "overview" && (
            <>
              <div className="mb-1 mt-3.5 flex flex-wrap gap-2" data-testid="stats-workspace">
                <Stat>
                  <b>{projects.length}</b> project{projects.length === 1 ? "" : "s"}
                </Stat>
                <Stat>
                  <b>{stats.entities}</b> entities
                </Stat>
                <Stat>
                  <b>{stats.sourceTables}</b> source tables
                </Stat>
                <Stat>
                  <b>{stats.approved}</b> of <b>{stats.mappings}</b> mappings approved
                </Stat>
                <Stat>
                  <b>0</b> of <b>0</b> requirements covered
                </Stat>
                {stats.typeProblems > 0 && (
                  <Stat warn>
                    <b>{stats.typeProblems}</b> type problem{stats.typeProblems > 1 ? "s" : ""}
                  </Stat>
                )}
              </div>
              {stats.entities === 0 && stats.sourceTables === 0 && (
                <Banner tone="info">
                  This workspace is empty. Next steps: add sources (import comes with architecture area A-04), create
                  concepts and entities, then set up projects and canvases.
                </Banner>
              )}

              <H3>Projects</H3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4" data-testid="tiles-projects">
                {projects.map((p) => {
                  const n = counts.get(p.id) ?? 0;
                  return (
                    <Link
                      key={p.id}
                      href={projectHref(workspace.id, p.id)}
                      data-testid="tile-project"
                      className="overflow-hidden rounded-[10px] bg-im-surface text-left shadow-[0_0_0_1px_var(--im-line),0_6px_16px_-12px_var(--im-shadow)] hover:shadow-[0_0_0_2px_var(--im-logical),0_10px_24px_-14px_var(--im-shadow)]"
                    >
                      <span className="block h-[140px] border-b border-im-line bg-im-canvas" />
                      <span className="block truncate px-3 pb-0.5 pt-2.5 text-[13.5px] font-semibold">{p.name}</span>
                      <span className="block px-3 pb-3 text-[11.5px] text-im-ink-3">
                        {n} canvas{n === 1 ? "" : "es"}
                        {p.description ? `. ${p.description}` : ""}
                      </span>
                    </Link>
                  );
                })}
                {can(access, "project.create") && <NewProjectTile workspaceId={workspace.id} />}
              </div>

              {isAdmin && (
                <>
                  <H3>Workspace lifecycle</H3>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-5">
                    <ArchiveBox
                      workspaceId={workspace.id}
                      workspaceName={workspace.name}
                      version={workspace.version}
                      archived={archived}
                      isOwner={isOwner}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {tab === "people" && (
            <>
              <p className="mt-3.5 text-im-ink-2">
                Roles apply to this workspace only. Guests come from another organization.
                {workspace.four_eyes ? " Four-eyes is on: nobody approves their own change." : ""}
              </p>
              <table className="w-full border-collapse text-[13px]" data-testid="table-people">
                <thead>
                  <tr>
                    <Th>Person</Th>
                    <Th>Role</Th>
                  </tr>
                </thead>
                <tbody>
                  {people.map(({ user, role, guestFrom }) => (
                    <tr key={user.id} data-testid="row-person">
                      <Td>
                        <span className="mr-2 inline-grid size-7 place-items-center rounded-full bg-im-logical-soft text-[11px] font-semibold text-im-logical">
                          {initials(user.display_name)}
                        </span>
                        {user.display_name} <span className="text-im-ink-3">{user.email}</span>
                        {guestFrom && (
                          <>
                            {" "}
                            <Badge>Guest from {guestFrom}</Badge>
                          </>
                        )}
                      </Td>
                      <Td>{ROLE_LABEL[role]}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <H3>What each role can do</H3>
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    {["Role", "Model", "Approve", "Canvases and notes", "People and settings"].map((h) => (
                      <Th key={h}>{h}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Owner", "edit", "yes", "yes", "everything, incl. delete and transfer"],
                    ["Admin", "edit", "yes", "yes", "invite, roles, settings"],
                    ["Modeler", "edit", "no", "yes", "no"],
                    ["Reviewer", "read, comment", "yes", "notes", "no"],
                    ["Reader", "read", "no", "no", "no"],
                  ].map((row) => (
                    <tr key={row[0]}>
                      {row.map((cell, i) => (
                        <Td key={i}>{cell}</Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {tab === "settings" && (
            <SettingsForm
              key={workspace.version}
              editable={can(access, "workspace.edit_settings")}
              initial={{
                workspaceId: workspace.id,
                version: workspace.version,
                name: workspace.name,
                clientName: workspace.client_name ?? "",
                description: workspace.description ?? "",
                docLanguage: workspace.doc_language,
                dv2Mode: workspace.dv2_mode,
                fourEyes: workspace.four_eyes,
              }}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}

function initials(name: string) {
  return name
    .split(/[\s.@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]!.toUpperCase())
    .join("");
}

function Badge({ children, className, testId }: { children: ReactNode; className?: string; testId?: string }) {
  return (
    <span
      data-testid={testId}
      className={
        "inline-flex h-[22px] items-center rounded-[11px] px-[9px] align-middle text-[11.5px] font-medium " +
        (className ?? "bg-im-hover text-im-ink-2")
      }
    >
      {children}
    </span>
  );
}

function Banner({ tone, testId, children }: { tone: "warn" | "info"; testId?: string; children: ReactNode }) {
  return (
    <div
      data-testid={testId}
      className={
        "mt-3.5 flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-im-ink " +
        (tone === "warn" ? "bg-im-warn-soft" : "bg-im-logical-soft")
      }
    >
      {children}
    </div>
  );
}

const Stat = ({ children, warn }: { children: ReactNode; warn?: boolean }) => (
  <span
    className={`rounded-[14px] bg-im-surface px-[11px] py-[3px] text-xs shadow-[0_0_0_1px_var(--im-line)] [&_b]:font-semibold ${warn ? "text-im-warn [&_b]:text-im-warn" : "text-im-ink-2 [&_b]:text-im-ink"}`}
  >
    {children}
  </span>
);
const H3 = ({ children }: { children: ReactNode }) => (
  <h3 className="mb-2.5 mt-[26px] text-[13px] font-semibold text-im-ink-2">{children}</h3>
);
const Th = ({ children }: { children: ReactNode }) => (
  <th className="border-b border-im-line px-2.5 py-2 text-left text-[11.5px] font-semibold text-im-ink-3">{children}</th>
);
const Td = ({ children }: { children: ReactNode }) => (
  <td className="border-b border-im-line px-2.5 py-2 text-left">{children}</td>
);
