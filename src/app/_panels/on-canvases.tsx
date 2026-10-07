"use client";

// “On canvases” in the entity and source table panels (prototype canvasList, slice 2a): every canvas that shows the
// element, as “this canvas”, “open” (another canvas of this project) or “in {project}”. A click opens that canvas, in
// its project, with the card selected and in view.

import { useRouter } from "next/navigation";
import { useContext } from "react";
import { CanvasUiCtx } from "@/canvas/context";
import type { Uuid } from "@/domain/ids";
import { useToast } from "@/ui/components/toast";
import { Fold, Hint, Li, List } from "./fields";
import { usePanel } from "./inspector";

export function OnCanvases({ kind, targetId, cardId }: { kind: "entity" | "source"; targetId: Uuid; cardId: Uuid }) {
  const p = usePanel();
  const ui = useContext(CanvasUiCtx);
  const router = useRouter();
  const toast = useToast();
  const on = new Set(p.canvasesOf[targetId] ?? []);
  const places = p.places.filter((c) => on.has(c.id));
  return (
    <Fold title="On canvases" count={places.length} testId="list-on-canvases">
      {places.length ? (
        <List>
          {places.map((c) => (
          <Li
            key={c.id}
            testId="item-on-canvas"
            meta={c.where}
            onClick={() => {
              if (c.id === p.canvasId) {
                ui.select({ t: "card", id: cardId });
                ui.centerOn(cardId);
                return;
              }
              if (c.switchTo) toast(`Switched to the project ${c.switchTo}.`);
              router.push(`${c.href}?card=${kind}:${targetId}`);
            }}
          >
            {c.name}
          </Li>
          ))}
        </List>
      ) : (
        <Hint>Not on any canvas. It still exists in the model with all its mappings.</Hint>
      )}
    </Fold>
  );
}
