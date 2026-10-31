"use client";

// “Entity aliases” and “Attribute aliases” in the top bar, after the layer switch (slice 11, D-64, F7): checked shows
// aliases, unchecked names, indeterminate while a card has an exception in that dimension. A click sets the canvas's
// mode and clears the cards' exceptions there, one undo step (`ui.setNames`). Editors only; reviewers and readers see
// them disabled, as saved (F6). Their state comes from `namesState` (data), and `indeterminate` is set in an effect:
// nothing here reads layout.

import { useContext, useEffect, useRef } from "react";
import type { NameDimension } from "@/domain/model/aliases";
import { CanvasUiCtx } from "./context";
import { useCanvasLook } from "./look";
import { namesState, nextMode } from "./names-state";
import { useValue } from "./value-store";

export const NAMES_SWITCHES: { dimension: NameDimension; label: string; title: string; testId: string }[] = [
  { dimension: "entity", label: "Entity aliases", title: "Show entity aliases on this canvas", testId: "check-entity-aliases" },
  { dimension: "attribute", label: "Attribute aliases", title: "Show attribute aliases on this canvas", testId: "check-attribute-aliases" },
];
export const NAMES_READ_ONLY = "Only editors change what this canvas shows";

function NameBox({ dimension, label, title, testId }: (typeof NAMES_SWITCHES)[number]) {
  const ui = useContext(CanvasUiCtx);
  const editable = !!useCanvasLook()?.editable;
  const state = useValue(namesState)?.[dimension] ?? "name";
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (box.current) box.current.indeterminate = state === "mixed";
  }, [state]);
  return (
    <label
      title={editable ? title : NAMES_READ_ONLY}
      className={`inline-flex h-[26px] flex-none items-center gap-1 whitespace-nowrap rounded-[5px] px-1 text-im-ink-2 ${editable ? "cursor-pointer hover:bg-im-hover hover:text-im-ink" : "cursor-default opacity-60"}`}
    >
      <input
        ref={box}
        type="checkbox"
        data-testid={testId}
        data-state={state}
        checked={state === "alias"}
        disabled={!editable}
        onChange={() => void ui.setNames(dimension, nextMode(state))}
        className="size-3.5 accent-[var(--im-logical)]"
      />
      {label}
    </label>
  );
}

export function NamesSwitch() {
  return (
    <div role="group" aria-label="Names or aliases" data-testid="switch-names" className="inline-flex flex-none items-center">
      {NAMES_SWITCHES.map((s) => (
        <NameBox key={s.dimension} {...s} />
      ))}
    </div>
  );
}
