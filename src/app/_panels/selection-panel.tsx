"use client";

// The right panel with several cards selected (slice 2a, PRD item 6; prototype insMulti): how many and of which kind,
// the group's actions, the selected cards (each a link that selects that card) and a short help text. Reviewers and
// readers only clear the selection.

import { useContext } from "react";
import { CanvasUiCtx } from "@/canvas/context";
import type { SelectionKey } from "@/canvas/selection";
import { Actions, buttonClass, dangerClass, Hint, Kind, Li, List, Section } from "./fields";
import { usePanel } from "./inspector";
import { feedingSourceCards } from "./model-index";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function SelectionPanel({ keys }: { keys: readonly SelectionKey[] }) {
  const p = usePanel();
  const ui = useContext(CanvasUiCtx);
  const entities = keys.filter((k) => k.startsWith("entity:")).map((k) => k.slice("entity:".length));
  const tables = keys.filter((k) => k.startsWith("source:")).map((k) => k.slice("source:".length));
  const counts = [entities.length && plural(entities.length, "entity", "entities"), tables.length && plural(tables.length, "table", "tables")].filter(Boolean);
  const open = (targetId: string) => {
    const card = p.cardOf(targetId);
    if (card) ui.select({ t: "card", id: card });
  };

  return (
    <div data-testid="panel-selection">
      <Kind>Selection</Kind>
      <h2 className="text-base font-semibold" data-testid="selection-count">
        {keys.length} items selected
      </h2>
      <Hint>
        <span data-testid="selection-kinds">{counts.join(", ")}.</span>
      </Hint>
      <Actions>
        {p.editable && entities.length > 0 && (
          <button type="button" className={buttonClass} data-testid="button-selection-sources" onClick={() => ui.placeSourcesOfSelection((id) => feedingSourceCards(p.ix, id))}>
            Add sources of selected entities
          </button>
        )}
        {p.editable && (
          <button type="button" className={dangerClass} data-testid="button-selection-remove" onClick={() => ui.removeSelection()}>
            Remove from this canvas
          </button>
        )}
        <button type="button" className={buttonClass} data-testid="button-selection-clear" onClick={() => ui.select(null)}>
          Clear selection
        </button>
      </Actions>
      <Section>Selected</Section>
      <List testId="list-selection">
        {keys.map((k) => {
          const isEntity = k.startsWith("entity:");
          const id = k.slice(k.indexOf(":") + 1);
          const name = isEntity ? p.ix.entity.get(id)?.name : p.ix.table.get(id)?.name;
          return (
            <Li key={k} meta={isEntity ? "entity" : "table"} onClick={() => open(id)} testId="selection-item">
              <span className={isEntity ? "truncate" : "truncate font-mono text-xs"}>{name ?? "?"}</span>
            </Li>
          );
        })}
      </List>
      <p className="mt-3 text-xs text-im-ink-3">
        Drag any selected item to move the whole group. Arrow keys nudge it, with Shift in bigger steps. Shift+click adds or removes items.
      </p>
    </div>
  );
}
