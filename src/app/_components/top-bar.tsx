"use client";

// The top bar as in the prototype: brand, Organization ▾ / Workspace ▾ / Project ▾ switchers and the user indicator.
// Slice 38 (S38-02, DS3.1): the canvas's controls are in its toolbar; the bar keeps the path, the working context and
// Undo and Redo (`tools`), the save pair, the panels' toggles and the account. With that room the switchers are up to
// 280 px wide (240 px up to 1,500 px, the prototype's `.bar .projbtn`), so no name in the path is cut to a few letters
// at 1,280 and 1,440 px; a long name ends with an ellipsis, the full name in the menu. The window steps left are the
// brand (up to 1,600 px), the user's role (up to 1,500 px) and the narrow one (up to 1,000 px), each a class on the
// element itself (AD-24 rule 4: nothing on the page or its grid). Pages with side panels get the buttons that show and
// hide them at the bar's two ends (slice 5a, prototype #tLeft, #tRight).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { DocLanguage } from "@/domain/types";
import { DOC_LANGUAGE_LABEL, DOC_LANGUAGE_OPTIONS } from "@/ui/doc-languages";
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
import { ThemeChoice } from "./theme-choice";
import { ChangePasswordDialog } from "./change-password";
import type { ActionResult } from "../_lib/run-command";
import type { ShellData } from "../_lib/shell";
import { projectHref, workspaceHref } from "../_lib/paths";
import { ROLE_CAN, ROLE_LABEL } from "../_lib/roles";
import { NewOrganizationDialog } from "./new-organization-dialog";
import { SavePair } from "./save-indicator";
import { PanelToggle } from "./side-panels";
import { Select } from "@/ui/components/select";
import { inputVariants } from "@/ui/components/input";
import { MENU_CONTENT, MENU_ITEM, MENU_LABEL, MENU_SEPARATOR } from "@/ui/components/menu";
import { toolButtonVariants } from "@/ui/components/tool-button";

/**
 * `savePair`: the save indicator and the server badge (slice 30), before the details panel's button, else before the
 * user indicator; off on a page that draws them in a bar of its own (the document editor, F16).
 */
export function TopBar({ shell, tools, panelToggles = false, savePair = true }: { shell: ShellData; tools?: ReactNode; panelToggles?: boolean; savePair?: boolean }) {
  return (
    <header
      data-testid="bar-top"
      className="flex h-12 min-w-0 flex-none items-center gap-2.5 overflow-hidden border-b border-im-line bg-im-surface px-2.5 max-[1001px]:gap-1.5 max-[1001px]:px-1.5"
    >
      {panelToggles && <PanelToggle side="left" />}
      {/* slice 30: hidden up to 1,600 px, as the prototype, to make room for the save pair */}
      <div className="mr-1.5 whitespace-nowrap max-[1601px]:hidden">
        <b className="text-sm font-semibold">InfoMapper</b>
      </div>
      <OrganizationSwitcher shell={shell} />
      <PathSep />
      <WorkspaceSwitcher shell={shell} />
      <PathSep />
      <ProjectSwitcher shell={shell} />
      <div className="flex-1" />
      {/* the switchers' names shorten first, so nothing is cut off from 800 to 2,560 px; what is still missing comes out of
          the working context's label down to its 40 px (slice 16, item 5; slice 38): the tools' tiny shrink weight lets the
          switchers reach their minimum first */}
      {tools && <div data-testid="bar-tools" className="flex min-w-0 shrink-[0.001] items-center gap-2 max-[1001px]:gap-1">{tools}</div>}
      {savePair && <SavePair server={shell.server} />}
      {panelToggles && <PanelToggle side="right" />}
      <UserIndicator shell={shell} />
    </header>
  );
}

const PathSep = () => <span className="-mx-0.5 text-im-ink-3 max-[1001px]:hidden">/</span>;

/** A switcher: its name cut with an ellipsis when long; the full name starts its title (slice 38). */
function SwitcherButton({ testId, title, children }: { testId: string; title: string; children: ReactNode }) {
  return (
    <DropdownMenuTrigger
      data-testid={testId}
      title={title}
      className={cn(toolButtonVariants(), "min-w-[56px] max-w-[280px] flex-initial px-2 font-medium max-[1501px]:max-w-[240px] max-[1501px]:px-1.5 max-[1001px]:min-w-[44px]")}
    >
      <span className="min-w-0 truncate">{children}</span>
      <svg viewBox="0 0 16 16" className="size-3 flex-none fill-none stroke-current stroke-[1.6]" aria-hidden>
        <path d="M4.5 6.5L8 10l3.5-3.5" />
      </svg>
    </DropdownMenuTrigger>
  );
}

// slice 37 (step 4): the menus' shared look (menu.ts)
const menuClass = cn("min-w-[230px] max-w-[300px]", MENU_CONTENT);
const sectionClass = cn(MENU_LABEL, "truncate");
const itemClass = cn(MENU_ITEM, "justify-between gap-4");

function MenuLink({
  href,
  current,
  hint,
  locked,
  testId,
  children,
}: {
  href: string;
  current?: boolean;
  hint?: string;
  /** An organization not yet unlocked in this session: its page asks for the password (slice 8, item 5, F15). */
  locked?: boolean;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenuItem asChild className={itemClass}>
      <Link href={href} data-testid={testId} aria-current={current ? "true" : undefined} data-locked={locked ? "true" : undefined}>
        <span className="truncate">{children}</span>
        <span className="flex items-center gap-2">
          {locked && (
            <span title="Asks for the password once" aria-label="Asks for the password once" data-testid="icon-locked" className="text-im-ink-3">
              <Lock className="size-3" aria-hidden />
            </span>
          )}
          {hint && <kbd className="text-[10.5px] font-normal text-im-ink-3">{hint}</kbd>}
          {current && <span className="font-semibold text-im-logical">✓</span>}
        </span>
      </Link>
    </DropdownMenuItem>
  );
}

function OrganizationSwitcher({ shell }: { shell: ShellData }) {
  const [creating, setCreating] = useState(false);
  return (
    <>
      <DropdownMenu>
        <SwitcherButton testId="switcher-organization" title={`${shell.organization.name}: switch organization`}>
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
                locked={o.locked}
                testId="menu-item-organization"
              >
                {o.name}
              </MenuLink>
            ) : null,
          )}
          {/* slice 29 (DB10), slice 30: no new organization online; scripts make them there until the people slice */}
          {shell.server.kind === "local" && (
            <>
              <DropdownMenuSeparator className={MENU_SEPARATOR} />
              <DropdownMenuItem className={itemClass} data-testid="menu-item-new-organization" onSelect={() => setCreating(true)}>
                New organization…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {creating && <NewOrganizationDialog onClose={() => setCreating(false)} />}
    </>
  );
}

function WorkspaceSwitcher({ shell }: { shell: ShellData }) {
  return (
    <DropdownMenu>
      <SwitcherButton
        testId="switcher-workspace"
        title={`${shell.workspace.name}: switch workspace, open the workspace home or create a workspace`}
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
        <DropdownMenuSeparator className={MENU_SEPARATOR} />
        <MenuLink href={workspaceHref(shell.workspace.id)}>Workspace home</MenuLink>
        {shell.canCreateWorkspace && (
          <NewWorkspaceField organizationId={shell.organization.id} />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProjectSwitcher({ shell }: { shell: ShellData }) {
  const { workspace, project, projects } = shell;
  return (
    <DropdownMenu>
      <SwitcherButton testId="switcher-project" title={`${project?.name ?? "Project"}: switch project, open the project home or create a project`}>
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
            <DropdownMenuSeparator className={MENU_SEPARATOR} />
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
/**
 * "New workspace" with its documentation language (slice 23, F1: a deliberate difference from the prototype, whose field
 * takes a name only): the built-in classifications get their names and definitions in it; English by default.
 */
function NewWorkspaceField({ organizationId }: { organizationId: string }) {
  const [language, setLanguage] = useState<DocLanguage>("en");
  return (
    <div className="flex items-center gap-1 pr-1.5">
      <NameThenEnter
        testId="input-new-workspace"
        className="mb-0.5 ml-1.5 mt-1 min-w-0 flex-1"
        placeholder="New workspace, press Enter"
        create={(name) => createWorkspaceAction({ organizationId, name, docLanguage: language })}
        success={(name) => `Created the workspace ${name}.`}
      />
      <Select
        size="sm"
        aria-label={DOC_LANGUAGE_LABEL}
        title={DOC_LANGUAGE_LABEL}
        data-testid="select-new-workspace-language"
        value={language}
        onChange={(e) => setLanguage(e.currentTarget.value as DocLanguage)}
        // keep the menu's type-ahead and its arrow keys out of the select
        onKeyDown={(e) => e.stopPropagation()}
        className="mb-0.5 mt-1 w-auto flex-none text-xs"
      >
        {DOC_LANGUAGE_OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
    </div>
  );
}

function NameThenEnter({
  testId,
  placeholder,
  create,
  success,
  className = "mx-1.5 mb-0.5 mt-1 w-[calc(100%-12px)]",
}: {
  className?: string;
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
      className={cn(inputVariants({ size: "sm" }), className)}
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
  // slice 29 (Q5, L5): a server that takes no writes says so, not "Archived"
  const label = workspace.archived ? "Archived" : ROLE_LABEL[role] + (guest ? " · guest" : "");
  const guestFrom = user.homeOrganizations.join(", ");
  // slice 33 (PT4): "Change password…" online only, a dialog of its own outside the menu
  const [changingPassword, setChangingPassword] = useState(false);
  const title = `${user.name}: ${workspace.archived ? "this workspace is archived (read-only)" : `${ROLE_LABEL[role]} in ${workspace.name}`}${guest ? `, guest from ${guestFrom}` : ""}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="indicator-user"
        data-standing={standing}
        title={title}
        className={cn(
          "ml-1 inline-flex h-control-bar flex-none items-center gap-1.5 rounded-full py-0 pl-[3px] pr-2 outline-none hover:shadow-[0_0_0_1px_var(--im-line)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-im-logical",
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
        <span data-testid="indicator-user-role" className="whitespace-nowrap text-xs font-medium max-[1501px]:hidden">
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
        <DropdownMenuSeparator className={MENU_SEPARATOR} />
        <MenuLink href={workspaceHref(workspace.id, "people")}>People and roles</MenuLink>
        <MenuLink href={workspaceHref(workspace.id)}>Workspace home</MenuLink>
        <DropdownMenuSeparator className={MENU_SEPARATOR} />
        {/* slice 32 (D-85): Light, Dark or System */}
        <ThemeChoice headingClass={sectionClass} />
        <DropdownMenuSeparator className={MENU_SEPARATOR} />
        {shell.server.kind === "online" && (
          <DropdownMenuItem asChild className={itemClass} onSelect={() => setChangingPassword(true)}>
            <button type="button" data-testid="button-change-password" className="w-full">
              Change password…
            </button>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild className={itemClass}>
          <button type="button" data-testid="button-sign-out" className="w-full" onClick={() => void signOut()}>
            Sign out
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
      {changingPassword && <ChangePasswordDialog email={user.email} onClose={() => setChangingPassword(false)} />}
    </DropdownMenu>
  );
}
