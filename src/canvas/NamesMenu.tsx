"use client";

// “Names ▾” in the canvas toolbar (slice 38, DS3.1, B1): one button whose pop-over holds slice 11's two check boxes,
// “Entity aliases” and “Attribute aliases” (`NamesSwitch`), with their states, titles, rights and test ids unchanged.
// The pop-over's content stays in the page while it is shut (hidden): the boxes' `indeterminate` is set in an effect as
// before and their states read without opening it; a click opens it first. Every role opens it; only editors change
// the boxes (D-64). A plain Radix pop-over in a portal, so the toolbar's own sideways scroll never cuts it.

import { Popover } from "radix-ui";
import { MENU_CONTENT } from "@/ui/components/menu";
import { toolButtonVariants } from "@/ui/components/tool-button";
import { cn } from "@/ui/lib/utils";
import { NamesSwitch } from "./NamesSwitch";

export const NAMES_MENU_TITLE = "Names or aliases on this canvas";

export function NamesMenu() {
  return (
    <Popover.Root>
      <Popover.Trigger data-testid="button-names" title={NAMES_MENU_TITLE} className={cn(toolButtonVariants({ size: "toolbar" }), "w-auto gap-1 px-1.5 text-[12.5px] font-medium")}>
        Names
        <svg viewBox="0 0 16 16" className="size-3 flex-none fill-none stroke-current stroke-[1.6]" aria-hidden>
          <path d="M4.5 6.5L8 10l3.5-3.5" />
        </svg>
      </Popover.Trigger>
      <Popover.Portal forceMount>
        <Popover.Content
          forceMount
          align="start"
          sideOffset={6}
          data-testid="menu-names"
          className={cn("z-50 min-w-[200px] data-[state=closed]:hidden", MENU_CONTENT)}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <NamesSwitch />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
