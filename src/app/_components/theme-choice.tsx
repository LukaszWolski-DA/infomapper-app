"use client";

// The person's menu's "Theme" section (slice 32, D-85; prototype `THEMES`, `seg-theme`): Light, Dark and System in one
// row, drawn as the menus' segmented control. They are Radix radio items (P2), so the menu's keyboard reaches them (the
// arrows, Enter and Space; Radix keeps plain buttons out of a menu's keyboard order): `menuitemradio` with
// `aria-checked`, a group named by the heading. A choice keeps the menu open (`preventDefault` on select), writes the
// cookie and shows the theme at once (`chooseTheme`). The section reads the theme the page shows each time the menu
// opens (it mounts with the menu's content), so another tab's choice that this page took on (`ThemeSync`) is the one
// marked.

import { useId, useState } from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { DropdownMenuLabel } from "@/ui/components/dropdown-menu";
import { THEME_OPTIONS, type Theme } from "@/ui/theme";
import { chooseTheme, shownTheme } from "@/ui/theme-sync";

export function ThemeChoice({ headingClass }: { headingClass: string }) {
  const id = useId();
  const [theme, setTheme] = useState<Theme>(() => (typeof document === "undefined" ? "system" : shownTheme()));
  return (
    <>
      <DropdownMenuLabel id={id} className={headingClass}>
        Theme
      </DropdownMenuLabel>
      <DropdownMenuPrimitive.RadioGroup
        value={theme}
        onValueChange={(v) => {
          const next = v as Theme;
          chooseTheme(next);
          setTheme(next);
        }}
        aria-labelledby={id}
        data-testid="seg-theme"
        className="mx-1.5 mb-1 flex rounded-md bg-im-hover p-0.5"
      >
        {THEME_OPTIONS.map(([value, label]) => (
          <DropdownMenuPrimitive.RadioItem
            key={value}
            value={value}
            onSelect={(e) => e.preventDefault()}
            data-testid={`theme-${value}`}
            className="flex h-[26px] flex-1 cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-[6px] px-2 text-im-ink-2 outline-none data-[highlighted]:text-im-ink focus-visible:ring-2 focus-visible:ring-im-logical/50 aria-checked:bg-im-surface aria-checked:text-im-ink aria-checked:shadow-[0_0_0_1px_var(--im-line),0_1px_2px_var(--im-shadow)]"
          >
            {label}
          </DropdownMenuPrimitive.RadioItem>
        ))}
      </DropdownMenuPrimitive.RadioGroup>
    </>
  );
}
