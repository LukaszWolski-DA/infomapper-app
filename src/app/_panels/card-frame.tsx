"use client";

// The card panel's “Frame” section (slice 2b, PRD item 12; prototype frameInfo): the frame the card belongs to on
// this canvas, as a link, or “Not in a frame on this canvas.” with “Put in a new concept frame” (an entity) or “Put in
// a new source system frame” (a table). It follows the canvas (`layoutKey`).

import { useContext } from "react";
import { CanvasUiCtx } from "@/canvas/context";
import type { Uuid } from "@/domain/ids";
import { Li, List, Section, smallButtonClass } from "./fields";
import { usePanel } from "./inspector";

const KIND_TEXT = { concept: "concept", source_system: "source system", free: "free area" } as const;

export function CardFrame({ cardId, kind }: { cardId: Uuid; kind: "ent" | "src" }) {
  const ui = useContext(CanvasUiCtx);
  const p = usePanel();
  const frame = ui.cardFrame(cardId);
  return (
    <div data-testid="section-card-frame">
      <Section>Frame</Section>
      {frame ? (
        <List>
          <Li meta={KIND_TEXT[frame.kind]} onClick={() => ui.select({ t: "frame", id: frame.id })} testId="link-card-frame">
            {frame.name}
          </Li>
        </List>
      ) : (
        <>
          <p className="text-im-ink-2">Not in a frame on this canvas.</p>
          {p.editable && (
            <div className="mt-2">
              <button type="button" className={smallButtonClass} onClick={() => ui.putInNewFrame([cardId], true)} data-testid="button-card-put-in-frame">
                Put in a new {kind === "ent" ? "concept" : "source system"} frame
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
