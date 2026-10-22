"use client";

// “More” (⋯) at the right end of the canvas tools (slice 6a, item 9; Łukasz's step 1 answer 7): on a narrow window the
// tools that do not fit leave the bar and are here instead. Up to 1,200 px Focus and the notation switch (the prototype
// hides them at 1,000 px, but the app has no other place for the notation and only card menus for Focus); up to 1,100 px
// also the Entity, Frame, Note and Hand tools (they keep their keys and the toolbox). Widths measured in step 4. Each
// tool's own element carries its breakpoint (`more-breakpoints.ts`), and so does each menu item; nothing is set on
// the page (AD-24 rule 4). The layer switch, the working context, undo, zoom, the details button and the user indicator
// always stay in the bar.

import { useContext } from "react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/components/dropdown-menu";
import { useToast } from "@/ui/components/toast";
import { ENTITY_TOOL_HINT, FRAME_TOOL_HINT, HAND_TOOL_HINT, NOTE_TOOL_HINT } from "./CanvasModes";
import { CanvasUiCtx, type Notation } from "./context";
import { focusOn } from "./fade";
import { MORE_FOCUS, MORE_TOOLS } from "./more-breakpoints";
import { toggleFocus } from "./Focus";
import { useValue } from "./value-store";

const TOOLS: { kind: "entity" | "frame" | "note" | "hand"; label: string; hint: string; testId: string; who: "edit" | "note" | "all" }[] = [
  { kind: "entity", label: "Entity tool (E)", hint: ENTITY_TOOL_HINT, testId: "more-tool-entity", who: "edit" },
  { kind: "frame", label: "Frame tool (A)", hint: FRAME_TOOL_HINT, testId: "more-tool-frame", who: "edit" },
  { kind: "note", label: "Note tool (N)", hint: NOTE_TOOL_HINT, testId: "more-tool-note", who: "note" },
  { kind: "hand", label: "Hand tool (H)", hint: HAND_TOOL_HINT, testId: "more-tool-hand", who: "all" },
];

const NOTATIONS: { value: Notation; label: string }[] = [
  { value: "ie", label: "Crow's foot" },
  { value: "uml", label: "UML" },
];

const itemClass =
  "flex cursor-pointer items-center gap-2 rounded-[5px] py-[7px] pl-7 pr-2.5 focus:bg-im-hover data-[highlighted]:bg-im-hover";

export function MoreTools({ editable, canNote }: { editable: boolean; canNote: boolean }) {
  const ui = useContext(CanvasUiCtx);
  const toast = useToast();
  const focus = useValue(focusOn);
  const tools = TOOLS.filter((t) => t.who === "all" || (t.who === "edit" ? editable : canNote));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="button-more-tools"
        title="More tools"
        aria-label="More tools"
        className={`inline-flex h-[30px] flex-none items-center rounded-md px-1.5 text-im-ink-2 outline-none hover:bg-im-hover hover:text-im-ink focus-visible:ring-2 focus-visible:ring-im-logical data-[state=open]:bg-im-hover ${MORE_FOCUS.inMenu}`}
      >
        <svg viewBox="0 0 16 16" className="size-4 fill-current" aria-hidden>
          <circle cx="3.5" cy="8" r="1.3" />
          <circle cx="8" cy="8" r="1.3" />
          <circle cx="12.5" cy="8" r="1.3" />
        </svg>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        data-testid="menu-more-tools"
        className="min-w-[220px] rounded-lg border-0 bg-im-surface p-1 text-[13px] text-im-ink shadow-[0_0_0_1px_var(--im-line),0_12px_28px_-10px_var(--im-shadow)]"
      >
        <DropdownMenuCheckboxItem
          data-testid="more-focus"
          checked={focus}
          onCheckedChange={() => toggleFocus(ui.selection, toast)}
          title="Fade everything not connected to the selection"
          className={itemClass}
        >
          Focus
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator className="mx-0.5 my-1 bg-im-line" />
        <DropdownMenuLabel className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold text-im-ink-2">Relationship notation</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={ui.notation} onValueChange={(v) => ui.setNotation(v as Notation)}>
          {NOTATIONS.map((n) => (
            <DropdownMenuRadioItem key={n.value} value={n.value} data-testid="more-notation" data-notation={n.value} className={itemClass}>
              {n.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator className={`mx-0.5 my-1 bg-im-line ${MORE_TOOLS.inMenu}`} />
        {tools.map((t) => {
          const on = ui.mode?.kind === t.kind;
          return (
            <DropdownMenuCheckboxItem
              key={t.kind}
              data-testid={t.testId}
              checked={on}
              onCheckedChange={() => {
                ui.setMode(on ? null : { kind: t.kind });
                if (!on) toast(t.hint);
              }}
              className={`${itemClass} ${MORE_TOOLS.inMenu}`}
            >
              {t.label}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
