"use client";

// The bar of the platform's pages outside a workspace (slice 39, S39-01): the landing zone ("InfoLabs apps") and
// InfoCatalog. The prototype's `bar()`: the apps button, the title, the page's own controls, the account. The account's
// menu is InfoMapper's (the name and e-mail, the theme, "Change password…" online, "Sign out"), without a workspace's
// role, which these pages have none of.

import { useState, type ReactNode } from "react";
import { cn } from "@/ui/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/ui/components/dropdown-menu";
import { MENU_CONTENT, MENU_ITEM, MENU_LABEL, MENU_SEPARATOR } from "@/ui/components/menu";
import { signOut } from "../_actions/session";
import { ChangePasswordDialog } from "./change-password";
import { ThemeChoice } from "./theme-choice";
import { AllApps } from "./top-bar";

export interface PlatformUser {
  name: string;
  email: string;
  /** Online (Postgres): the account's password is the person's own. */
  online: boolean;
}

export function PlatformBar({ title, user, children }: { title: ReactNode; user: PlatformUser; children?: ReactNode }) {
  return (
    <header data-testid="bar-platform" className="sticky top-0 z-[2] flex h-12 min-w-0 flex-none items-center gap-2.5 border-b border-im-line bg-im-surface px-2.5">
      <AllApps />
      <span data-testid="text-platform-title" className="whitespace-nowrap text-sm font-semibold max-[601px]:hidden">
        {title}
      </span>
      {children}
      <span className="flex-1" />
      <AccountMenu user={user} />
    </header>
  );
}

function AccountMenu({ user }: { user: PlatformUser }) {
  const [changingPassword, setChangingPassword] = useState(false);
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .map((x) => x[0]!)
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="indicator-account"
        title={user.name}
        className="inline-flex h-control-bar flex-none items-center gap-1.5 rounded-full bg-im-hover py-0 pl-[3px] pr-2 text-im-ink-2 outline-none hover:text-im-ink hover:shadow-[0_0_0_1px_var(--im-line)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-im-logical"
      >
        <span className="grid size-6 place-items-center rounded-full bg-im-logical text-[11px] font-semibold text-white">{initials}</span>
        <span className="whitespace-nowrap text-xs font-medium max-[601px]:hidden">{user.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn("min-w-[230px] max-w-[300px]", MENU_CONTENT)} data-testid="menu-account">
        <div className="mb-1 border-b border-im-line px-2.5 pb-2 pt-1">
          <b className="block text-[13px] font-semibold">{user.name}</b>
          <span className="text-xs text-im-ink-3">{user.email}</span>
        </div>
        <ThemeChoice headingClass={cn(MENU_LABEL, "truncate")} />
        <DropdownMenuSeparator className={MENU_SEPARATOR} />
        {user.online && (
          <DropdownMenuItem asChild className={cn(MENU_ITEM, "justify-between gap-4")} onSelect={() => setChangingPassword(true)}>
            <button type="button" data-testid="button-change-password" className="w-full">
              Change password…
            </button>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild className={cn(MENU_ITEM, "justify-between gap-4")}>
          <button type="button" data-testid="button-sign-out" className="w-full" onClick={() => void signOut()}>
            Sign out
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
      {changingPassword && <ChangePasswordDialog email={user.email} onClose={() => setChangingPassword(false)} />}
    </DropdownMenu>
  );
}
