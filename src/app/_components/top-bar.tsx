"use client";

// The top bar as in the prototype: brand, Organization ▾ / Workspace ▾ / Project ▾ switchers and the user indicator.
// Canvas tools (layers, Focus, Hand, Entity, Note, Frame, notation, zoom, panels) arrive with the canvas (AD-24).

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/ui/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/components/dropdown-menu";
import { signOut } from "../_actions/session";
import { createProjectAction, createWorkspaceAction } from "../_actions/workspace";
import { useAction } from "./use-action";
import type { ActionResult } from "../_lib/run-command";
import type { ShellData } from "../_lib/shell";
import { projectHref, workspaceHref } from "../_lib/paths";
import { ROLE_CAN, ROLE_LABEL } from "../_lib/roles";

export function TopBar({ shell }: { shell: ShellData }) {
  return (
    <header
      data-testid="bar-top"
      className="flex h-12 min-w-0 flex-none items-center gap-2.5 border-b border-im-line bg-im-surface px-2.5"
    >
      <div className="mr-1.5 hidden whitespace-nowrap sm:block">
        <b className="text-sm font-semibold">InfoMapper</b>
      </div>
      <OrganizationSwitcher shell={shell} />
      <PathSep />
      <WorkspaceSwitcher shell={shell} />
      <PathSep />
      <ProjectSwitcher shell={shell} />
      <div className="flex-1" />
      <UserIndicator shell={shell} />
    </header>
  );
}

const PathSep = () => <span className="-mx-0.5 hidden text-im-ink-3 md:inline">/</span>;

function SwitcherButton({ testId, title, children }: { testId: string; title: string; children: ReactNode }) {
  return (
    <DropdownMenuTrigger
      data-testid={testId}
      title={title}
      className="inline-flex h-[30px] max-w-[260px] items-center gap-1.5 rounded-md px-2 font-medium text-im-ink-2 outline-none hover:bg-im-hover hover:text-im-ink focus-visible:ring-2 focus-visible:ring-im-logical data-[state=open]:bg-im-hover"
    >
      <span className="truncate">{children}</span>
      <svg viewBox="0 0 16 16" className="size-3 flex-none fill-none stroke-current stroke-[1.6]" aria-hidden>
        <path d="M4.5 6.5L8 10l3.5-3.5" />
      </svg>
    </DropdownMenuTrigger>
  );
}

const menuClass =
  "min-w-[230px] max-w-[300px] rounded-lg border-0 bg-im-surface p-1 text-[13px] text-im-ink shadow-[0_0_0_1px_var(--im-line),0_12px_28px_-10px_var(--im-shadow)]";
const sectionClass = "truncate px-2.5 pb-1 pt-1.5 text-[11px] font-semibold text-im-ink-2";
const itemClass =
  "flex cursor-pointer items-center justify-between gap-4 rounded-[5px] px-2.5 py-[7px] focus:bg-im-hover data-[highlighted]:bg-im-hover";

function MenuLink({
  href,
  current,
  hint,
  testId,
  children,
}: {
  href: string;
  current?: boolean;
  hint?: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenuItem asChild className={itemClass}>
      <Link href={href} data-testid={testId} aria-current={current ? "true" : undefined}>
        <span className="truncate">{children}</span>
        <span className="flex items-center gap-2">
          {hint && <kbd className="text-[10.5px] font-normal text-im-ink-3">{hint}</kbd>}
          {current && <span className="font-semibold text-im-logical">✓</span>}
        </span>
      </Link>
    </DropdownMenuItem>
  );
}

function OrganizationSwitcher({ shell }: { shell: ShellData }) {
  return (
    <DropdownMenu>
      <SwitcherButton testId="switcher-organization" title="Switch organization">
        {shell.organization.name}
      </SwitcherButton>
      <DropdownMenuContent align="start" className={menuClass}>
        <DropdownMenuLabel className={sectionClass}>Organizations</DropdownMenuLabel>
        {shell.organizations.map((o) =>
          o.firstWorkspaceId ? (
            <MenuLink
              key={o.id}
              href={workspaceHref(o.firstWorkspaceId)}
              current={o.id === shell.organization.id}
              hint={o.guest ? "guest" : `${o.workspaceCount} workspace${o.workspaceCount === 1 ? "" : "s"}`}
              testId="menu-item-organization"
            >
              {o.name}
            </MenuLink>
          ) : null,
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkspaceSwitcher({ shell }: { shell: ShellData }) {
  return (
    <DropdownMenu>
      <SwitcherButton
        testId="switcher-workspace"
        title="Switch workspace, open the workspace home or create a workspace"
      >
        {shell.workspace.name}
      </SwitcherButton>
      <DropdownMenuContent align="start" className={menuClass}>
        <DropdownMenuLabel className={sectionClass}>Workspaces in {shell.organization.name}</DropdownMenuLabel>
        {shell.workspaces.map((w) => (
          <MenuLink
            key={w.id}
            href={workspaceHref(w.id)}
            current={w.id === shell.workspace.id}
            hint={w.archived ? "archived" : ROLE_LABEL[w.role]}
            testId="menu-item-workspace"
          >
            {w.name}
          </MenuLink>
        ))}
        <DropdownMenuSeparator className="mx-0.5 my-1 bg-im-line" />
        <MenuLink href={workspaceHref(shell.workspace.id)}>Workspace home</MenuLink>
        {shell.canCreateWorkspace && (
          <NameThenEnter
            testId="input-new-workspace"
            placeholder="New workspace name, then Enter"
            create={(name) => createWorkspaceAction({ organizationId: shell.organization.id, name })}
            success={(name) => `Created the workspace ${name}.`}
          />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProjectSwitcher({ shell }: { shell: ShellData }) {
  const { workspace, project, projects } = shell;
  return (
    <DropdownMenu>
      <SwitcherButton testId="switcher-project" title="Switch project, open the project home or create a project">
        {project?.name ?? "Project"}
      </SwitcherButton>
      <DropdownMenuContent align="start" className={menuClass}>
        <DropdownMenuLabel className={sectionClass}>Projects</DropdownMenuLabel>
        {projects.map((p) => (
          <MenuLink
            key={p.id}
            href={projectHref(workspace.id, p.id)}
            current={p.id === project?.id}
            hint={`${p.canvasCount} canvas${p.canvasCount === 1 ? "" : "es"}`}
            testId="menu-item-project"
          >
            {p.name}
          </MenuLink>
        ))}
        {project && (
          <>
            <DropdownMenuSeparator className="mx-0.5 my-1 bg-im-line" />
            <MenuLink href={projectHref(workspace.id, project.id)}>Project home</MenuLink>
          </>
        )}
        {shell.canCreateProject && (
          <NameThenEnter
            testId="input-new-project"
            placeholder="New project name, then Enter"
            create={(name) => createProjectAction({ workspaceId: workspace.id, name })}
            success={(name) => `Created the project ${name}.`}
          />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** "Name, then Enter" field at the bottom of a switcher menu: creates the thing and opens it. */
function NameThenEnter({
  testId,
  placeholder,
  create,
  success,
}: {
  testId: string;
  placeholder: string;
  create: (name: string) => Promise<ActionResult<{ href: string }>>;
  success: (name: string) => string;
}) {
  const { run, pending } = useAction();
  const router = useRouter();
  return (
    <input
      data-testid={testId}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      disabled={pending}
      className="mx-1.5 mb-0.5 mt-1 h-[30px] w-[calc(100%-12px)] rounded-md border border-im-line bg-im-surface px-2"
      onKeyDown={async (e) => {
        e.stopPropagation(); // keep the menu's type-ahead out of the field
        const name = e.currentTarget.value.trim();
        if (e.key !== "Enter" || !name) return;
        const result = await run(() => create(name), success(name));
        if (result.ok) router.push(result.value.href);
      }}
    />
  );
}

/** Initials, role and colour by what the role allows: neutral, amber (review) or red (read-only or archived). */
function UserIndicator({ shell }: { shell: ShellData }) {
  const { user, workspace, role, guest, standing } = shell;
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .map((x) => x[0]!)
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const label = workspace.archived ? "Archived" : ROLE_LABEL[role] + (guest ? " · guest" : "");
  const guestFrom = user.homeOrganizations.join(", ");
  const title = `${user.name}: ${workspace.archived ? "this workspace is archived (read-only)" : `${ROLE_LABEL[role]} in ${workspace.name}`}${guest ? `, guest from ${guestFrom}` : ""}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="indicator-user"
        data-standing={standing}
        title={title}
        className={cn(
          "ml-1 inline-flex h-[30px] flex-none items-center gap-1.5 rounded-[15px] py-0 pl-[3px] pr-2 outline-none hover:shadow-[0_0_0_1px_var(--im-line)] focus-visible:ring-2 focus-visible:ring-im-logical",
          standing === "full" && "bg-im-hover text-im-ink-2 hover:text-im-ink",
          standing === "review" && "bg-im-review-soft text-im-review",
          standing === "none" && "bg-im-warn-soft text-im-warn",
        )}
      >
        <span
          className={cn(
            "grid size-6 place-items-center rounded-full text-[11px] font-semibold text-white",
            standing === "full" && "bg-im-logical",
            standing === "review" && "bg-im-review-strong",
            standing === "none" && "bg-im-warn",
          )}
        >
          {initials}
        </span>
        <span data-testid="indicator-user-role" className="whitespace-nowrap text-xs font-medium">
          {label}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={menuClass} data-testid="menu-user">
        <div className="mb-1 border-b border-im-line px-2.5 pb-2 pt-1">
          <b className="block text-[13px] font-semibold">{user.name}</b>
          <span className="text-xs text-im-ink-3">{user.email}</span>
        </div>
        <div data-testid="menu-user-role" className="max-w-[280px] px-2.5 py-1.5 text-[12.5px] leading-[1.45]">
          In <b className="font-semibold">{workspace.name}</b> you are <b className="font-semibold">{ROLE_LABEL[role]}</b>
          {guest ? (
            <>
              , a guest from {guestFrom}
            </>
          ) : null}
          .<br />
          {workspace.archived ? "The workspace is archived, so everything is read-only." : ROLE_CAN[role]}
        </div>
        <DropdownMenuSeparator className="mx-0.5 my-1 bg-im-line" />
        <MenuLink href={workspaceHref(workspace.id, "people")}>People and roles</MenuLink>
        <MenuLink href={workspaceHref(workspace.id)}>Workspace home</MenuLink>
        <DropdownMenuSeparator className="mx-0.5 my-1 bg-im-line" />
        <DropdownMenuItem asChild className={itemClass}>
          <button type="button" data-testid="button-sign-out" className="w-full" onClick={() => void signOut()}>
            Sign out
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
