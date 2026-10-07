"use client";

// Undo and redo on the canvas page (slice 1b): Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y outside a text field, the two buttons
// in the top bar (prototype #tUndo, #tRedo) and the “Undo” link in toasts. Steps run one after the other, after the
// canvas has saved what is still on its way. Whether there is something to undo comes from the server with every
// fresh page; a card change saved without a fresh page (a move, a width) turns Undo on and Redo off right here.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CanvasUiCtx } from "@/canvas/context";
import { doneStepMessage } from "@/domain/model/undo-history";
import { useToast } from "@/ui/components/toast";
import { undoAction, type UndoState } from "../_actions/undo";

interface UndoApi {
  state: UndoState;
  undo: () => void;
  redo: () => void;
}

const UndoCtx = createContext<UndoApi | null>(null);

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

export function UndoProvider({
  workspaceId,
  projectId,
  canvasId,
  state: server,
  children,
}: {
  workspaceId: string;
  /** The open project: a step that takes the open canvas out of it opens another canvas (slice 2a). */
  projectId: string;
  /** The open canvas: a step on another canvas says which one in its toast. */
  canvasId: string;
  state: UndoState;
  children: ReactNode;
}) {
  const ui = useContext(CanvasUiCtx);
  const toast = useToast();
  /** What happened here since the server's state arrived; a fresh page replaces it. */
  const [local, setLocal] = useState<{ from: UndoState; state: UndoState } | null>(null);
  const state = local && local.from === server ? local.state : server;
  const serverRef = useRef(server);
  const stateRef = useRef(state);
  useEffect(() => {
    serverRef.current = server;
    stateRef.current = state;
  }, [server, state]);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const run = useCallback(
    (mode: "undo" | "redo", always = false) => {
      // Nothing to undo: the keys do nothing, as in the prototype. A toast's “Undo” always asks the server.
      if (!always && !(mode === "undo" ? stateRef.current.canUndo : stateRef.current.canRedo)) return;
      queue.current = queue.current.then(async () => {
        await ui.settled();
        const result = await undoAction(workspaceId, mode, { projectId, canvasId }).catch(() => ({
          ok: false as const,
          message: "Something went wrong. Nothing was changed.",
        }));
        if (!result.ok) {
          toast(result.message, "refusal");
          return;
        }
        setLocal({ from: serverRef.current, state: { canUndo: result.value.canUndo, canRedo: result.value.canRedo } });
        const { label, canvas } = result.value;
        toast(doneStepMessage(mode, label, canvas && canvas.id !== canvasId ? canvas.name : null));
      });
    },
    [ui, workspaceId, projectId, canvasId, toast],
  );
  const undo = useCallback(() => run("undo"), [run]);
  const redo = useCallback(() => run("redo"), [run]);

  useEffect(() => {
    ui.registerUndo({ undo: () => run("undo", true), noteSaved: () => setLocal({ from: serverRef.current, state: { canUndo: true, canRedo: false } }) });
    return () => ui.registerUndo(null);
  }, [ui, run]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (k === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const api = useMemo(() => ({ state, undo, redo }), [state, undo, redo]);
  return <UndoCtx.Provider value={api}>{children}</UndoCtx.Provider>;
}

/** The page's undo, where there is one (canvas pages). */
export const useUndo = () => useContext(UndoCtx);

const btn =
  "inline-flex h-[30px] items-center rounded-md px-1.5 text-im-ink-2 hover:bg-im-hover hover:text-im-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-im-logical disabled:pointer-events-none disabled:opacity-40";
const svg = "size-4 fill-none stroke-current stroke-[1.5] [stroke-linecap:round] [stroke-linejoin:round]";

/** The top bar's Undo and Redo buttons. */
export function UndoButtons() {
  const api = useUndo();
  if (!api) return null;
  return (
    <div className="flex flex-none items-center" data-testid="group-undo">
      <button type="button" className={btn} title="Undo (Ctrl+Z)" data-testid="button-undo" disabled={!api.state.canUndo} onClick={api.undo}>
        <svg viewBox="0 0 16 16" className={svg} aria-hidden>
          <path d="M5.5 3.5L2.5 6.5l3 3" />
          <path d="M2.5 6.5h7a4 4 0 010 8H7" />
        </svg>
      </button>
      <button type="button" className={btn} title="Redo (Ctrl+Shift+Z)" data-testid="button-redo" disabled={!api.state.canRedo} onClick={api.redo}>
        <svg viewBox="0 0 16 16" className={svg} aria-hidden>
          <path d="M10.5 3.5l3 3-3 3" />
          <path d="M13.5 6.5h-7a4 4 0 000 8H9" />
        </svg>
      </button>
    </div>
  );
}
