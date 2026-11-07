"use client";

// The open canvas's look (D-12) and layer mode (D-22), slice 2a: background, grid, and which lines show. A change
// shows at once and is saved in `canvas.look` (not an undo step); after a refusal the newest stored look shows, as a
// choice field does (D-66, slice 14b). Reviewers and readers may switch the layer mode, but only in their browser: it is
// not saved and lasts until they leave the canvas. Saves go on the save chain keyed on the canvas's row (`rowSaves`,
// slice 14b, O1), with its rename, its delete and the names switch, so none is refused because of another.
// The frame around the tabs and the canvas carries the background (prototype #center[data-bg]).
// Slice 16 (item 3, D-71): the relationship lines hidden by kind are look keys too (`canvas-look.ts`); reviewers and
// readers have no switches, and a chip's × shows a kind in their browser only, as the layer.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useToast } from "@/ui/components/toast";
import { rowSaves } from "@/ui/row-saves";
import { DEFAULT_CANVAS_LOOK, type CanvasLook } from "@/domain/types";
import { applyLookPatch, HIDDEN_RELATIONSHIP_KEYS, type CanvasLookPatch } from "@/domain/model/canvas-look";

export type LookPatch = CanvasLookPatch;

/** What a reviewer or a reader changes in their browser only: the layer and the hidden kinds (not saved). */
const localPart = (l: CanvasLook): CanvasLookPatch => ({
  layer: l.layer,
  ...Object.fromEntries(HIDDEN_RELATIONSHIP_KEYS.map((k) => [k, l[k] === true])),
});
export type SaveLookResult = { ok: true; value: { version: number } } | { ok: false; code?: string; message: string };

export interface CanvasLookApi {
  canvasId: string;
  look: CanvasLook;
  /** May change and save the look (owner, admin, modeler; not archived). */
  editable: boolean;
  /** Editors: shown at once and saved. Others: only the layer mode and the hidden kinds, in this browser. */
  setLook: (patch: LookPatch) => void;
}

export const CanvasLookCtx = createContext<CanvasLookApi | null>(null);
export const useCanvasLook = () => useContext(CanvasLookCtx);

export const BACKGROUNDS = [
  ["grey", "Grey"],
  ["white", "White"],
  ["blue", "Blue"],
  ["warm", "Warm"],
] as const;
export const GRIDS = [
  ["dots", "Dots"],
  ["lines", "Lines"],
  ["none", "None"],
] as const;

export function CanvasLookProvider({
  canvasId,
  look: server,
  version,
  editable,
  save,
  children,
}: {
  canvasId: string;
  /** The saved look, fresh with every page. */
  look: CanvasLook;
  /** The canvas row's version as the page shows it; the chain sends the newest it knows (AD-12). */
  version: number;
  editable: boolean;
  save: (input: { canvasId: string; expectedVersion: number } & LookPatch) => Promise<SaveLookResult>;
  children: ReactNode;
}) {
  const toast = useToast();
  const [look, setLookState] = useState<CanvasLook>(server);
  const pending = useRef(0);
  // the newest page's look and version, for a save sent later and for a refusal (a ref: no render)
  const page = useRef({ look: server, version });
  useEffect(() => {
    page.current = { look: server, version };
  });

  // A fresh page brings the saved look; a change still on its way keeps what the user picked.
  const { background, grid, layer, hideEntityRelationships, hideSourceRelationships } = server;
  useEffect(() => {
    if (pending.current) return;
    const stored = applyLookPatch({ background, grid, layer }, { hideEntityRelationships: !!hideEntityRelationships, hideSourceRelationships: !!hideSourceRelationships });
    setLookState((l) => (editable ? stored : applyLookPatch(stored, localPart(l))));
  }, [background, grid, layer, hideEntityRelationships, hideSourceRelationships, editable]);

  const setLook = useCallback(
    (patch: LookPatch) => {
      if (!editable) {
        setLookState((l) => applyLookPatch(l, { layer: patch.layer, hideEntityRelationships: patch.hideEntityRelationships, hideSourceRelationships: patch.hideSourceRelationships }));
        return;
      }
      setLookState(applyLookPatch(look, patch));
      pending.current += 1;
      void rowSaves
        .save(canvasId, page.current.version, async (expectedVersion): Promise<SaveLookResult> => {
          try {
            return await save({ canvasId, expectedVersion, ...patch });
          } catch {
            return { ok: false, message: "Something went wrong. Nothing was saved." };
          }
        })
        .then((result) => {
          pending.current -= 1;
          if (result?.ok) return;
          // refused, or cut behind a refusal (its toast says why): the newest stored look shows (O3); a later page
          // brings a newer one through the effect above
          const stored = applyLookPatch(page.current.look, {});
          setLookState((l) => (editable ? stored : applyLookPatch(stored, localPart(l))));
          if (result) toast(result.message, "refusal");
        });
    },
    [editable, look, save, canvasId, toast],
  );

  const api = useMemo(() => ({ canvasId, look, editable, setLook }), [canvasId, look, editable, setLook]);
  return <CanvasLookCtx.Provider value={api}>{children}</CanvasLookCtx.Provider>;
}

/** The part of the page that takes the open canvas's background: tabs, breadcrumbs and canvas. */
export function LookFrame({ className, children }: { className?: string; children: ReactNode }) {
  const look = useCanvasLook()?.look ?? DEFAULT_CANVAS_LOOK;
  return (
    <div className={className} data-bg={look.background} data-testid="frame-canvas-look">
      {children}
    </div>
  );
}

const segClass =
  "h-[26px] flex-1 whitespace-nowrap rounded-[5px] px-2 text-im-ink-2 aria-pressed:bg-im-surface aria-pressed:text-im-ink aria-pressed:shadow-[0_0_0_1px_var(--im-line),0_1px_2px_var(--im-shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-im-logical";

/** Background swatches and the grid choice (prototype lookControls, gridControls), for the tab menu and the panel. */
export function LookControls({
  look,
  onChange,
  part,
}: {
  look: Pick<CanvasLook, "background" | "grid">;
  onChange: (patch: LookPatch) => void;
  part: "background" | "grid";
}) {
  if (part === "background") {
    return (
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Background" data-testid="group-canvas-background">
        {BACKGROUNDS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            title={`${label} background`}
            aria-pressed={look.background === value}
            data-background={value}
            onClick={() => onChange({ background: value })}
            className="group flex flex-col items-center gap-[3px] rounded-lg p-0.5 text-[11px] text-im-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-im-logical"
          >
            <span
              data-bg={value}
              className="im-swatch block h-[26px] w-[34px] rounded-md shadow-[inset_0_0_0_1px_var(--im-line)] group-aria-pressed:shadow-[0_0_0_2px_var(--im-logical)]"
            />
            {label}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="flex rounded-[7px] bg-im-hover p-0.5" role="group" aria-label="Grid" data-testid="group-canvas-grid">
      {GRIDS.map(([value, label]) => (
        <button key={value} type="button" aria-pressed={look.grid === value} data-grid={value} onClick={() => onChange({ grid: value })} className={segClass}>
          {label}
        </button>
      ))}
    </div>
  );
}
