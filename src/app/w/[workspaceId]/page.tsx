import { TimingRecord } from "@/app/_lib/timing";
import { dataVaultUses, indexOf } from "@/domain/model/classifications";
import { stereotypeUses } from "@/domain/model/stereotypes";
import Link from "next/link";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { AppShell } from "@/app/_components/app-shell";
import { GoneNotice } from "@/app/_components/gone-notice";
import { UndoButtons, UndoProvider } from "@/app/_components/undo";
import { projectHref, workspaceHref } from "@/app/_lib/paths";
import { ROLE_LABEL } from "@/app/_lib/roles";
import { loadShell } from "@/app/_lib/shell";
import { thumbnailHrefs } from "@/app/_lib/thumbnails";
import { workspaceStats } from "@/app/_panels/stats";
import { getDataStore } from "@/data";
import { buildRequirementIndex } from "@/domain/model/requirement-index";
import { can } from "@/domain/permissions";
import { CanvasThumbnail } from "@/ui/canvas-thumbnail";
import { ArchiveBox, UnarchiveButton } from "./_components/lifecycle";
import { NewProjectTile } from "./_components/new-project-tile";
import { OrganizationAccessBox, RemovePersonButton, RoleSelect } from "./_components/people";
import { InvitationButtons, InvitePersonBox, ResetLinkButton } from "./_components/invitations";
import { pendingInvitations, resetRefusal } from "@/domain/commands/invitations";
import { resetReachOf } from "@/app/_lib/people-links";
import { invitationsReady, NOT_SET_UP } from "@/app/_lib/supabase-admin";
import { inviteDate } from "@/ui/invite-date";
import { SettingsForm } from "./_components/settings-form";
import { BaselinesTab } from "./_components/baselines";
import { Conventions } from "./_components/conventions";
import { settingsBoxes } from "@/compose/settings";
import { HOME_GONE, homeTabs } from "@/compose/home";
import { OFF_CANVAS, offCanvasNotice } from "@/compose/catalog";
import { baselineExtensions } from "@/compose/baselines-ui";
import { chosenHomeTab } from "@/ui/home-tabs";
import { moduleFeeds, STORE_SCHEMA } from "@/compose";
import { workspacePeople } from "@/app/_lib/people";
import { tabsListVariants, tabVariants } from "@/ui/components/tabs";

const ITEM_PARAM = ["item"] as const;

export default async function WorkspaceHomePage({ params, searchParams }: PageProps<"/w/[workspaceId]">) {
  const { workspaceId } = await params;
  const query = await searchParams;
  const shell = await loadShell({ workspaceId });
  const store = getDataStore();
  const workspace = (await store.workspaces.get(workspaceId))!;
  const [members, users, projects, model, requirements, requirementLinks, history, baselines] = await Promise.all([
    store.workspaces.listMembers(workspaceId),
    workspacePeople(store, workspaceId),
    store.projects.list(workspaceId),
    store.model.load(workspaceId),
    store.requirements.list(workspaceId),
    store.requirements.listLinks(workspaceId),
    store.undoHistory.state(workspaceId, shell.user.id),
    // slice 35: the rows only (the tab's count and list), never a content
    store.baselines.list(workspaceId),
  ]);
  const orgMemberships = await store.organizations.listMembershipsOfUsers(members.map((m) => m.user_id));
  const organizations = await Promise.all(
    [...new Set(orgMemberships.map((m) => m.organization_id))].map((id) => store.organizations.get(id)),
  );
  const orgName = (id: string) => organizations.find((o) => o?.id === id)?.name ?? "";

  const access = { workspace, member: members.find((m) => m.user_id === shell.user.id) ?? null };
  // slice 25 (F10): a module's tabs after Overview, while it shows them; `?tab=` naming another is Overview
  const moduleTabs = await homeTabs(access);
  const tab = chosenHomeTab(query.tab, moduleTabs);
  const moduleTab = moduleTabs.find((t) => t.id === tab);
  const archived = shell.workspace.archived;
  // slice 29 (Q5): a server that takes no writes offers no change, as an archive does
  const canHere = (action: Parameters<typeof can>[1]) => can(access, action);
  const isOwner = shell.role === "owner";
  const isAdmin = isOwner || shell.role === "admin";
  const roleLabel = ROLE_LABEL[shell.role] + (shell.guest ? " · guest" : "");
  // People (slice 8, items 10–13): owners and admins change people, not in an archived workspace; an admin leaves owners
  // alone and nobody changes their own row (F12). The access box is for the organization's owners and admins (F17).
  const managesPeople = canHere("people.edit");
  const mayChange = (userId: string, role: string) => managesPeople && userId !== shell.user.id && (isOwner || role !== "owner");
  const organizationRole = (await store.organizations.getMember(workspace.organization_id, shell.user.id))?.role;
  const organizationAccess =
    !archived && (organizationRole === "owner" || organizationRole === "admin")
      ? { version: (await store.organizations.getAccess(workspace.organization_id))?.version ?? null, link: await organizationLink(workspace.organization_id) }
      : null;

  // slice 33: pending invitations (D6) and, online, who may get a reset link from this person (D1)
  const online = shell.server.kind === "online";
  const ready = invitationsReady();
  const pending = managesPeople ? pendingInvitations(await store.invitations.listOpen(workspaceId), new Date().toISOString()) : [];
  const resettable = new Set<string>();
  if (online && ready && managesPeople) {
    for (const m of members) {
      const person = users.find((u) => u.id === m.user_id);
      if (person && !resetRefusal(shell.user.id, access, person, members, await resetReachOf(store, person.id, shell.user.id))) resettable.add(person.id);
    }
  }

  const people = members.map((m) => {
    const user = users.find((u) => u.id === m.user_id)!;
    const homes = orgMemberships.filter((o) => o.user_id === m.user_id);
    const guest = !homes.some((o) => o.organization_id === workspace.organization_id);
    return { user, role: m.role, guestFrom: guest ? homes.map((o) => orgName(o.organization_id)).join(", ") : null };
  });

  const stats = workspaceStats(model);
  // the whole workspace's requirements and how many are covered, as the canvas status bar (slice 4a)
  // what feeds the facts and dimensions (slice 15d, D4): the requirements follow dimensional mappings; the thumbnails count them
  const { rowFeeds, feeds } = await moduleFeeds(workspaceId, model);
  const requirementIndex = buildRequirementIndex(requirements, requirementLinks, model, feeds);
  const counts = new Map(shell.projects.map((p) => [p.id, p.canvasCount]));

  // Each project tile shows its first canvas's thumbnail, in tab order (slice 12b, P8; prototype renderWsHome): the
  // first canvases' rows only, one index for the page; on the Overview tab only
  const firstCanvas = new Map<string, string>();
  let thumbnails = new Map<string, string | null>();
  if (tab === "overview") {
    const [links, canvases, items, frames, notes, labels, labelLinks] = await Promise.all([
      Promise.all(projects.map(async (p) => [p.id, (await store.canvases.listLinksOfProject(workspaceId, p.id))[0]?.canvas_id] as const)),
      store.canvases.list(workspaceId),
      store.canvasItems.list(workspaceId),
      store.frames.list(workspaceId),
      store.notes.list(workspaceId),
      store.labels.list(workspaceId),
      store.labels.listLinks(workspaceId),
    ]);
    for (const [projectId, canvasId] of links) if (canvasId) firstCanvas.set(projectId, canvasId);
    const shown = canvases.filter((c) => [...firstCanvas.values()].includes(c.id));
    // a fact's or a dimension's rows count their feeds, as on the canvas (slice 15c, C12)
    thumbnails = thumbnailHrefs(workspaceId, shown, { items, frames, notes }, { model, requirements, labels, labelLinks, rowFeeds });
  }

  // slice 39 (S39-05): InfoCatalog's "Open in InfoMapper" found the item on no canvas; its name is read here
  const offCanvas = query.gone === OFF_CANVAS && typeof query.item === "string" ? await offCanvasNotice(workspaceId, query.item) : null;

  // slice 38 (B3): the organization's other workspaces this person has, as the workspace switcher lists them
  const otherWorkspaces = shell.workspaces.filter((w) => w.id !== workspace.id);
  // Undo and Redo, buttons and keys, on the person's history of the workspace (slice 12a, D-65)
  return (
    <UndoProvider workspaceId={workspaceId} state={history}>
    <AppShell shell={shell} tools={<UndoButtons />}>
      {query.gone === "project" && <GoneNotice message="That project no longer exists." />}
      {/* slice 25 (step 4b): a module's page the person can no longer open sent them back here */}
      {typeof query.gone === "string" && HOME_GONE[query.gone] && <GoneNotice message={HOME_GONE[query.gone]!} />}
      {offCanvas && <GoneNotice message={offCanvas} drop={ITEM_PARAM} />}
      <div data-testid="page-workspace-home" className="min-h-full bg-im-surface px-[clamp(16px,4vw,48px)] pb-12 pt-6">
        {/* slice 38 (S38-03): up to 1,320 px, centred, the prototype's gutters */}
        <div className="mx-auto max-w-[1320px]">
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

          <div role="tablist" className={`${tabsListVariants()} mb-1 mt-4`}>
            {(
              [
                ["overview", "Overview"],
                ...moduleTabs.map((t) => [t.id, t.label] as const),
                ["baselines", `Baselines (${baselines.length})`],
                ["people", `People (${members.length})`],
                ["conventions", "Metadata conventions"],
                ["settings", "Settings"],
              ] as const
            ).map(([key, label]) => (
              <Link
                key={key}
                // the tab is not a place of its own (slice 6b, prototype): it replaces the entry, Back leaves the page
                replace
                role="tab"
                aria-selected={tab === key}
                data-testid={`tab-${key}`}
                href={workspaceHref(workspace.id, key === "overview" ? undefined : key)}
                // slice 37 (step 5): the shared tabs, at their natural width (F8)
                className={tabVariants()}
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
                <Stat testId="stat-workspace-requirements">
                  <b>{requirementIndex.coveredCount}</b> of <b>{requirementIndex.requirements.length}</b> requirements covered
                </Stat>
                {stats.typeProblems > 0 && (
                  <Stat warn>
                    <b>{stats.typeProblems}</b> type problem{stats.typeProblems > 1 ? "s" : ""}
                  </Stat>
                )}
              </div>
              {stats.entities === 0 && stats.sourceTables === 0 && (
                <Banner tone="info">
                  This workspace is empty. Next steps: import sources, create concepts and entities, then set up projects
                  and canvases.
                </Banner>
              )}

              <H3>Projects</H3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4" data-testid="tiles-projects">
                {projects.map((p) => {
                  const n = counts.get(p.id) ?? 0;
                  return (
                    <Link
                      key={p.id}
                      href={projectHref(workspace.id, p.id)}
                      data-testid="tile-project"
                      className="overflow-hidden rounded-lg bg-im-surface text-left shadow-[0_0_0_1px_var(--im-line),0_6px_16px_-12px_var(--im-shadow)] hover:shadow-[0_0_0_2px_var(--im-logical),0_10px_24px_-14px_var(--im-shadow)]"
                    >
                      <span className="block h-[140px] border-b border-im-line bg-im-canvas">
                        {firstCanvas.has(p.id) && <CanvasThumbnail href={thumbnails.get(firstCanvas.get(p.id)!) ?? null} />}
                      </span>
                      <span className="block truncate px-3 pb-0.5 pt-2.5 text-[13.5px] font-semibold">{p.name}</span>
                      <span className="block px-3 pb-3 text-[11.5px] text-im-ink-3">
                        {n} canvas{n === 1 ? "" : "es"}
                        {p.description ? `. ${p.description}` : ""}
                      </span>
                    </Link>
                  );
                })}
                {canHere("project.create") && <NewProjectTile workspaceId={workspace.id} />}
              </div>

              {isAdmin && (
                <>
                  <H3>Workspace lifecycle</H3>
                  {/* slice 38 (B5): the prototype's four in a row when there is room; today's one card */}
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
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

              {/* slice 38 (B3): what the prototype's right panel said, at the Overview's end; not shown without another */}
              {otherWorkspaces.length > 0 && (
                <section data-testid="section-other-workspaces">
                  <H3>Other workspaces in {shell.organization.name}</H3>
                  <div className="flex max-w-[560px] flex-col">
                    {otherWorkspaces.map((w) => (
                      <Link
                        key={w.id}
                        href={workspaceHref(w.id)}
                        data-testid="item-other-workspace"
                        className="flex min-h-target items-baseline gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-im-hover"
                      >
                        <span className="min-w-0 flex-1 truncate">{w.name}</span>
                        {w.archived && <span className="flex-none text-[11.5px] text-im-ink-3">archived</span>}
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {tab === "baselines" && (
            <BaselinesTab
              workspaceId={workspace.id}
              // slice 36 (F1): the modules' buttons and the delete dialog's documents' line, read only for this tab
              extensions={await baselineExtensions(getDataStore(STORE_SCHEMA), access)}
              workspaceName={workspace.name}
              rights={{ create: canHere("baseline.create"), rename: canHere("baseline.rename"), delete: canHere("baseline.delete") }}
              baselines={baselines.map((b) => ({
                id: b.id,
                version: b.version,
                name: b.name,
                note: b.note,
                created_at: b.created_at,
                // the people the page may name: every author of a change event, so the baseline's taker too
                by: users.find((u) => u.id === b.created_by)?.display_name ?? "?",
                entity_count: b.entity_count,
                mapping_count: b.mapping_count,
                requirement_count: b.requirement_count,
              }))}
            />
          )}

          {tab === "people" && (
            <>
              <p className="mt-3.5 text-im-ink-2">
                Roles apply to this workspace only. Guests come from another organization.
                {workspace.four_eyes ? " Four-eyes is on: nobody approves their own change." : ""}
              </p>
              <table className="w-full table-fixed border-collapse text-[13px]" data-testid="table-people">
                <PeopleColumns managed={managesPeople} />
                <thead>
                  <tr>
                    <Th>Person</Th>
                    <Th>Role</Th>
                    {managesPeople && <Th>{null}</Th>}
                  </tr>
                </thead>
                <tbody>
                  {people.map(({ user, role, guestFrom }) => (
                    <tr key={user.id} data-testid="row-person">
                      <Td className="[overflow-wrap:anywhere]">
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
                      <Td>
                        {mayChange(user.id, role) ? (
                          <RoleSelect workspaceId={workspace.id} userId={user.id} name={user.display_name} role={role} ownerOffered={isOwner} />
                        ) : (
                          <span data-testid="text-person-role">{ROLE_LABEL[role]}</span>
                        )}
                      </Td>
                      {managesPeople && (
                        <Td className="whitespace-nowrap">
                          {resettable.has(user.id) && <ResetLinkButton workspaceId={workspace.id} userId={user.id} />}
                          {mayChange(user.id, role) && <RemovePersonButton workspaceId={workspace.id} userId={user.id} name={user.display_name} />}
                        </Td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {managesPeople && <InvitePersonBox workspaceId={workspace.id} ready={ready} notReadyText={NOT_SET_UP} />}
              {pending.length > 0 && (
                <>
                  <H3>Pending invitations</H3>
                  <table className="w-full table-fixed border-collapse text-[13px]" data-testid="table-pending">
                    <PeopleColumns managed />
                    <thead>
                      <tr>
                        <Th>E-mail</Th>
                        <Th>Role</Th>
                        <Th>{null}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {pending.map((i) => (
                        <tr key={i.id} data-testid="row-pending" data-expired={i.expired || undefined}>
                          <Td className="[overflow-wrap:anywhere]">
                            <span className="italic text-im-ink-3">{i.email}</span>{" "}
                            <span data-testid="text-pending-expiry" className={i.expired ? "text-[12px] text-im-warn" : "text-[12px] text-im-ink-3"}>
                              · {i.expired ? "expired" : "expires"} {inviteDate(i.expiresAt)}
                            </span>
                          </Td>
                          <Td>{ROLE_LABEL[i.role]}</Td>
                          <Td className="whitespace-nowrap">
                            <InvitationButtons workspaceId={workspace.id} invitationId={i.id} email={i.email} roleLabel={ROLE_LABEL[i.role]} ready={ready} />
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {organizationAccess && <OrganizationAccessBox workspaceId={workspace.id} link={organizationAccess.link} version={organizationAccess.version} />}
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
                    ["Admin", "edit", "yes", "yes", "invite people, roles (not owners), settings"],
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

          {tab === "conventions" && (
            <Conventions
              workspaceId={workspace.id}
              workspaceVersion={workspace.version}
              // D-57's roles for every field of the tab (Q7): owners, admins and modelers, not in an archived workspace
              editable={canHere("model.edit")}
              dataVault={workspace.dv2_mode}
              classifications={model.classifications}
              uses={classificationUses(model)}
              // slice 21 (D-76): "Concept colours", moved here from Settings (item 12)
              concepts={model.concepts
                .filter((c) => c.deleted_at === null)
                .sort((x, y) => x.sort_order - y.sort_order)
                .map((c) => ({ id: c.id, version: c.version, name: c.name, color: c.color }))}
              namingConventions={workspace.naming_conventions}
              // slice 24: the stereotypes, removed ones too (their codes stay taken), and their live logical uses
              stereotypes={model.stereotypes}
              stereotypeUses={stereotypeUses(model.entities)}
            />
          )}

          {moduleTab ? await moduleTab.body() : null}

          {tab === "settings" && (
            <SettingsForm
              editable={canHere("workspace.edit_settings")}
              modules={await settingsBoxes(store, access)}
              dataVaultUses={dataVaultUses(indexOf(model))}
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
    {/* slice 29 (Q9): the page's reads, hidden, with INFOMAPPER_TIMING=1 only */}
    <TimingRecord />
    </UndoProvider>
  );
}

/** Each classification's live uses on tables and columns (slice 23, the tab's "Used"; plain numbers, F7). */
function classificationUses(model: Parameters<typeof indexOf>[0]): Record<string, number> {
  const ix = indexOf(model);
  return Object.fromEntries(ix.list.map((c) => {
    const u = ix.uses(c.id);
    return [c.id, u.tables.length + u.columns.length];
  }));
}

/** The organization's sign-in link (item 13), on the host this page was asked for. */
async function organizationLink(organizationId: string) {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/sign-in?org=${organizationId}`;
}

/** The prototype's column widths for both people tables (P-a): the person, 140 px for the role, 236 px for the buttons. */
function PeopleColumns({ managed }: { managed: boolean }) {
  return (
    <colgroup>
      <col />
      <col className="w-[140px]" />
      {managed && <col className="w-[236px]" />}
    </colgroup>
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

const Stat = ({ children, warn, testId }: { children: ReactNode; warn?: boolean; testId?: string }) => (
  <span
    data-testid={testId}
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
const Td = ({ children, className }: { children: ReactNode; className?: string }) => (
  <td className={"border-b border-im-line px-2.5 py-2 " + (className ?? "text-left")}>{children}</td>
);
