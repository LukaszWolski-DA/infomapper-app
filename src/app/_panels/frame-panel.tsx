"use client";

// The frame panel (slice 2b; prototype insFrame). Step 2: the name, ready to type after a frame is drawn, and the
// actions to zoom to the frame and delete it. What it stands for, its cards, its numbers and what does not belong
// there come in step 3 (PRD item 9).

import { useContext, useEffect, useRef } from "react";
import { CanvasUiCtx } from "@/canvas/context";
import type { Uuid } from "@/domain/ids";
import { Actions, buttonClass, dangerClass, Field, Kind, TextField } from "./fields";
import { usePanels } from "./panels-context";
import { usePanel } from "./inspector";

export function FramePanel({ frameId }: { frameId: Uuid }) {
  const ui = useContext(CanvasUiCtx);
  const p = usePanel();
  const { nameFocus, setNameFocus } = usePanels();
  const nameRef = useRef<HTMLInputElement>(null);
  const view = ui.frameView(frameId);

  useEffect(() => {
    if (nameFocus !== frameId) return;
    nameRef.current?.focus();
    nameRef.current?.select();
    setNameFocus(null);
  }, [nameFocus, frameId, setNameFocus]);

  if (!view) return null;
  const f = view.frame;
  return (
    <div data-testid="panel-frame">
      <Kind>Frame on this canvas</Kind>
      <Field label="Name" htmlFor="f-fn">
        <TextField
          key={`${f.id}:${f.version}`}
          id="f-fn"
          value={f.name}
          required
          readOnly={!p.editable}
          onSave={(name) => void ui.updateFrame(f.id, { name })}
          testId="input-frame-name"
          inputRef={nameRef}
        />
      </Field>
      <Actions>
        <button type="button" className={buttonClass} onClick={() => ui.zoomToFrame(f.id)} data-testid="button-frame-zoom">
          Zoom to frame
        </button>
        {p.editable && (
          <button type="button" className={dangerClass} onClick={() => ui.deleteFrame(f.id)} data-testid="button-frame-delete">
            Delete frame
          </button>
        )}
      </Actions>
      <p className="mt-2 text-xs text-im-ink-3">Deleting a frame keeps everything inside it on the canvas.</p>
    </div>
  );
}
