"use client";

// Crow's foot / UML in the top bar (prototype data-not buttons): one setting for every canvas (D-22).

import { useContext } from "react";
import { CanvasUiCtx, type Notation } from "./context";

const OPTIONS: { value: Notation; label: string; short: string; title: string }[] = [
  { value: "ie", label: "Crow's foot", short: "IE", title: "Crow's foot (Information Engineering)" },
  { value: "uml", label: "UML", short: "UML", title: "UML multiplicity, as in Enterprise Architect" },
];

export function NotationSwitch() {
  const ui = useContext(CanvasUiCtx);
  return (
    <div role="group" aria-label="Relationship notation" data-testid="switch-notation" className="hidden flex-none rounded-[7px] bg-im-hover p-0.5 sm:inline-flex">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={ui.notation === o.value}
          data-notation={o.value}
          onClick={() => ui.setNotation(o.value)}
          className="h-[26px] whitespace-nowrap rounded-[5px] px-2.5 text-im-ink-2 aria-pressed:bg-im-surface aria-pressed:text-im-ink aria-pressed:shadow-[0_0_0_1px_var(--im-line),0_1px_2px_var(--im-shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-im-logical"
        >
          <span className="hidden xl:inline">{o.label}</span>
          <span className="xl:hidden">{o.short}</span>
        </button>
      ))}
    </div>
  );
}
