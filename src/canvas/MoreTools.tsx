"use client";

// “More” (⋯) at the canvas toolbar's right end (slice 6a, item 9; slice 38, B2): the groups that do not fit the toolbar
// leave it and are here instead, by the toolbar's own room (`more-breakpoints.ts`), never the window's. First the names'
// check boxes (slice 11, under “Names ▾” in the toolbar), then Focus, the Changes view (slice 7b) and the notation
// switch, then the Hand, Entity, Note and Frame tools (they keep their keys and the toolbox). The toolbar's wrappers hide
// by a container query; these items live in a portal, so each compares its group with the strip's width as
// `toolbarRoom` reports it. The layer switch and zoom always stay in the toolbar.

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
import { CHANGES_TITLE, changesOn, toggleChanges } from "./changes-view";
import { focusOn } from "./fade";
import { useCanvasLook } from "./look";
import { namesState, nextMode } from "./names-state";
import { NAMES_READ_ONLY, NAMES_SWITCHES } from "./NamesSwitch";
import { inMore, MORE_BUTTON, MORE_FOCUS, MORE_NAMES, MORE_TOOLS } from "./more-breakpoints";
import { toolbarRoom } from "./toolbar-room";
import { ToolbarSeparator } from "./CanvasToolbar";
import { toggleFocus } from "./Focus";
import { useValue } from "./value-store";
import { MENU_CONTENT, MENU_LABEL } from "@/ui/components/menu";
import { cn } from "@/ui/lib/utils";
import { toolButtonVariants } from "@/ui/components/tool-button";

// the toolbar's order (slice 38: the prototype's #tHand, #tEnt, #tNote, #tFrame)
const TOOLS: { kind: "entity" | "frame" | "note" | "hand"; label: string; hint: string; testId: string; who: "edit" | "note" | "all" }[] = [
  { kind: "hand", label: "Hand tool (H)", hint: HAND_TOOL_HINT, testId: "more-tool-hand", who: "all" },
  { kind: "entity", label: "Entity tool (E)", hint: ENTITY_TOOL_HINT, testId: "more-tool-entity", who: "edit" },
  { kind: "note", label: "Note tool (N)", hint: NOTE_TOOL_HINT, testId: "more-tool-note", who: "note" },
  { kind: "frame", label: "Frame tool (A)", hint: FRAME_TOOL_HINT, testId: "more-tool-frame", who: "edit" },
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
  const changes = !!useValue(changesOn);
  // the names' check boxes come here with Focus (slice 11, F7)
  const namesNow = useValue(namesState);
  const lookEditable = !!useCanvasLook()?.editable;
  const tools = TOOLS.filter((t) => t.who === "all" || (t.who === "edit" ? editable : canNote));
  const room = useValue(toolbarRoom);
  // each group's items: shown here only while the group is out of the toolbar
  const names = inMore(MORE_NAMES, room) ? "" : "hidden";
  const focusIn = inMore(MORE_FOCUS, room) ? "" : "hidden";
  const toolsIn = inMore(MORE_TOOLS, room) ? "" : "hidden";
  return (
    <span className={`contents ${MORE_BUTTON}`}>
    <ToolbarSeparator />
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="button-more-tools"
        title="More tools"
        aria-label="More tools"
        className={toolButtonVariants({ size: "toolbar" })}
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
        className={cn("min-w-[220px]", MENU_CONTENT)}
      >
        {NAMES_SWITCHES.map((n) => {
          const state = namesNow?.[n.dimension] ?? "name";
          return (
            <DropdownMenuCheckboxItem
              key={n.dimension}
              data-testid={`more-${n.testId.replace("check-", "")}`}
              data-state-names={state}
              checked={state === "mixed" ? "indeterminate" : state === "alias"}
              disabled={!lookEditable}
              onCheckedChange={() => void ui.setNames(n.dimension, nextMode(state))}
              title={lookEditable ? n.title : NAMES_READ_ONLY}
              className={`${itemClass} data-[disabled]:opacity-60 ${names}`}
            >
              {n.label}
            </DropdownMenuCheckboxItem>
          );
        })}
        <DropdownMenuSeparator className={`mx-0.5 my-1 bg-im-line ${focusIn}`} />
        <DropdownMenuCheckboxItem
          data-testid="more-focus"
          checked={focus}
          onCheckedChange={() => toggleFocus(ui.selection, toast)}
          title="Fade everything not connected to the selection"
          className={`${itemClass} ${focusIn}`}
        >
          Focus
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem data-testid="more-changes" checked={changes} onCheckedChange={toggleChanges} title={CHANGES_TITLE} className={`${itemClass} ${focusIn}`}>
          Changes
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator className={`mx-0.5 my-1 bg-im-line ${focusIn}`} />
        <DropdownMenuLabel className={cn(MENU_LABEL, focusIn)}>Relationship notation</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={ui.notation} onValueChange={(v) => ui.setNotation(v as Notation)}>
          {NOTATIONS.map((n) => (
            <DropdownMenuRadioItem key={n.value} value={n.value} data-testid="more-notation" data-notation={n.value} className={`${itemClass} ${focusIn}`}>
              {n.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator className={`mx-0.5 my-1 bg-im-line ${toolsIn}`} />
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
              className={`${itemClass} ${toolsIn}`}
            >
              {t.label}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
    </span>
  );
}
