"use client";

// A section's figures in the editor's right panel (slice 27, the prototype's `figEditor`): each figure with "In the
// document", its name, Move up, Move down and Remove; its view, size and orientation; with "Adjusted" its rows, line
// kinds and status marks; its caption; the line the tree gave it ("1 figure · names 7.4 pt · upright"); then "Canvas or
// frame to add" and "Add figure". Every change saves the section's whole list (`figures`) on the save chain as one
// choice (`useChoice`); the caption keeps its draft (D-66) and saves on Enter or when it is left.

import { useId, useMemo, useState } from "react";
import type { useAction } from "@/app/_components/use-action";
import { TextField, useChoice } from "@/app/_panels/fields";
import { uuidv7 } from "@/domain/ids";
import { newFigure, type FigureEntry } from "@/domain/document/figure-entry";

type Answer = ReturnType<ReturnType<typeof useAction>["saveRow"]>;

/** A canvas or one of its frames, as "Canvas or frame to add" offers it. */
export interface FigureSource {
  canvasId: string;
  frameId: string | null;
  name: string;
}

export const FIGURE_TEXTS = {
  inDocument: "In the document",
  up: "Move up",
  down: "Move down",
  remove: "Remove",
  views: [
    ["canvas", "As on the canvas"],
    ["custom", "Adjusted"],
  ],
  sizes: [
    ["auto", "Whole, as large as fits"],
    ["page", "Whole, upright"],
    ["width", "Page width, in parts"],
    ["100", "100 %, in parts"],
    ["75", "75 %, in parts"],
    ["50", "50 %, in parts"],
  ],
  orientations: [
    ["doc", "As the document"],
    ["portrait", "Portrait"],
    ["landscape", "Landscape, turned"],
  ],
  rows: [
    ["canvas", "Rows as on canvas"],
    ["keys", "Keys only"],
    ["all", "All rows"],
    ["none", "Headers only"],
  ],
  lines: [
    ["rel", "Relationships"],
    ["map", "Mappings"],
    ["src", "Source FKs"],
    ["cube", "Dimensional"],
  ],
  status: "Status marks",
  /** Slice 28 (finding 1): the selects' accessible names. */
  names: { view: "View", size: "Size", orientation: "Orientation", rows: "Rows" },
  caption: "Caption",
  captionPlaceholder: (name: string) => `Caption: ${name}`,
  off: "Not in the document.",
  none: "None yet.",
  add: "Canvas or frame to add",
  addButton: "Add figure",
  noCanvas: "(canvas no longer exists)",
  noFrame: "(frame no longer exists)",
} as const;

/** A figure's name as the editor shows it: "{canvas}" or "{canvas} · {frame}", or that it is gone. */
export function figureEditorName(f: Pick<FigureEntry, "canvasId" | "frameId">, sources: readonly FigureSource[]): string {
  const canvas = sources.find((s) => s.canvasId === f.canvasId && s.frameId === null);
  if (!canvas) return FIGURE_TEXTS.noCanvas;
  if (!f.frameId) return canvas.name;
  return `${canvas.name} · ${sources.find((s) => s.frameId === f.frameId)?.name ?? FIGURE_TEXTS.noFrame}`;
}

const selectClass = "h-7 min-w-0 flex-1 rounded-md border border-im-line bg-im-surface px-1.5 text-[12px] text-im-ink";
const iconButton = "grid h-6 w-6 place-items-center rounded-md text-im-ink-3 hover:bg-im-hover hover:text-im-ink disabled:opacity-40";

export function FigureEditor(props: {
  sectionId: string;
  label: string;
  hint?: string;
  stored: readonly FigureEntry[];
  sources: readonly FigureSource[];
  /** The tree's line per figure (F15), by its id. */
  summaries: ReadonlyMap<string, string>;
  /** "Dimensional" only while the dimensional level is drawn (D7). */
  dimensional: boolean;
  readOnly: boolean;
  version: number;
  /** Slice 27, step 3: the caption's text while it is typed, for the preview (`fig:{section}:{figure}`, D-81's drafts). */
  typed?: (key: string) => (text: string) => void;
  save: (figures: FigureEntry[]) => Answer;
}) {
  const { sectionId, label, hint, sources, summaries, dimensional, readOnly, version, typed, save } = props;
  // the stored list as one object while it stays the same: `useChoice` shows a choice made on that object (D-66)
  const storedKey = JSON.stringify(props.stored);
  const stored = useMemo(() => JSON.parse(storedKey) as FigureEntry[], [storedKey]);
  const choice = useChoice<readonly FigureEntry[]>(stored, (v) => save([...v]));
  const figures = choice.value;
  const change = (i: number, patch: Partial<FigureEntry>) => choice.choose(figures.map((f, k) => (k === i ? { ...f, ...patch } : f)));
  const move = (i: number, by: -1 | 1) => {
    const next = [...figures];
    const [f] = next.splice(i, 1);
    next.splice(i + by, 0, f!);
    choice.choose(next);
  };
  const [pick, setPick] = useState(0);
  const lines = FIGURE_TEXTS.lines.filter(([k]) => k !== "cube" || dimensional);
  const groupId = useId();
  return (
    <div className="de-wrap mt-3" role="group" aria-labelledby={`${groupId}-label`} data-testid="figure-editor">
      <div id={`${groupId}-label`} className="mb-1 text-[11.5px] text-im-ink-3">
        {label}
      </div>
      {hint && <div className="mb-1.5 mt-[-2px] text-[11.5px] text-im-ink-3">{hint}</div>}
      {figures.map((f, i) => {
        const name = figureEditorName(f, sources);
        const sel = <K extends "view" | "size" | "orientation" | "rows">(key: K, items: readonly (readonly [string, string])[]) => (
          <select
            data-testid={`select-figure-${key}`}
            aria-label={FIGURE_TEXTS.names[key]}
            className={selectClass}
            value={f[key]}
            disabled={readOnly}
            onChange={(e) => change(i, { [key]: e.currentTarget.value } as Partial<FigureEntry>)}
          >
            {items.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        );
        return (
          // slice 28 (F6): each class a whole word of its own; `p-2${…}` was one token for Tailwind's scanner, never generated
          <div key={f.id} className={`mb-2 rounded-lg border border-im-line p-2 ${f.on ? "" : "opacity-70"}`} data-testid="figure-entry" data-figure={f.id}>
            <div className="flex items-center gap-1.5">
              <input type="checkbox" data-testid="check-figure-on" checked={f.on} disabled={readOnly} aria-label={FIGURE_TEXTS.inDocument} title={FIGURE_TEXTS.inDocument} onChange={(e) => change(i, { on: e.currentTarget.checked })} />
              <b className="min-w-0 flex-1 truncate text-[12.5px]" data-testid="text-figure-name" title={name}>
                {name}
              </b>
              <button type="button" className={iconButton} data-testid="button-figure-up" aria-label={FIGURE_TEXTS.up} title={FIGURE_TEXTS.up} disabled={readOnly || i === 0} onClick={() => move(i, -1)}>
                ↑
              </button>
              <button type="button" className={iconButton} data-testid="button-figure-down" aria-label={FIGURE_TEXTS.down} title={FIGURE_TEXTS.down} disabled={readOnly || i === figures.length - 1} onClick={() => move(i, 1)}>
                ↓
              </button>
              <button type="button" className={iconButton} data-testid="button-figure-remove" aria-label={FIGURE_TEXTS.remove} title={FIGURE_TEXTS.remove} disabled={readOnly} onClick={() => choice.choose(figures.filter((_, k) => k !== i))}>
                ✕
              </button>
            </div>
            {f.on ? (
              <>
                {/* slice 28 (F2): view and orientation on one row, the size on its own (its longest choice needs the width) */}
                <div className="mt-1.5 flex gap-1" data-testid="figure-row-view">
                  {sel("view", FIGURE_TEXTS.views)}
                  {sel("orientation", FIGURE_TEXTS.orientations)}
                </div>
                <div className="mt-1 flex gap-1" data-testid="figure-row-size">
                  {sel("size", FIGURE_TEXTS.sizes)}
                </div>
                {f.view === "custom" && <div className="mt-1 flex gap-1">{sel("rows", FIGURE_TEXTS.rows)}</div>}
                {f.view === "custom" && (
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
                    {lines.map(([k, l]) => (
                      <label key={k} className="flex items-center gap-1">
                        <input type="checkbox" data-testid={`check-figure-line-${k}`} checked={f.lines[k]} disabled={readOnly} onChange={(e) => change(i, { lines: { ...f.lines, [k]: e.currentTarget.checked } })} /> {l}
                      </label>
                    ))}
                    <label className="flex items-center gap-1">
                      <input type="checkbox" data-testid="check-figure-status" checked={f.status} disabled={readOnly} onChange={(e) => change(i, { status: e.currentTarget.checked })} /> {FIGURE_TEXTS.status}
                    </label>
                  </div>
                )}
                <div className="mt-1.5">
                  <label htmlFor={`${groupId}-${f.id}-caption`} className="sr-only">
                    {FIGURE_TEXTS.caption}
                  </label>
                  <TextField
                    key={`${sectionId}:${f.id}:caption`}
                    id={`${groupId}-${f.id}-caption`}
                    value={f.caption}
                    version={version}
                    readOnly={readOnly}
                    placeholder={FIGURE_TEXTS.captionPlaceholder(name)}
                    testId="input-figure-caption"
                    {...(typed ? { onType: typed(`fig:${sectionId}:${f.id}`) } : {})}
                    onSave={(v) => save(figures.map((x) => (x.id === f.id ? { ...x, caption: v.trim() } : x)))}
                  />
                </div>
                {summaries.get(f.id) && (
                  <div className="mt-1 text-[11.5px] text-im-ink-3" data-testid="text-figure-summary">
                    {summaries.get(f.id)}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-1 text-[11.5px] text-im-ink-3">{FIGURE_TEXTS.off}</div>
            )}
          </div>
        );
      })}
      {!figures.length && <div className="text-[11.5px] text-im-ink-3">{FIGURE_TEXTS.none}</div>}
      {!readOnly && sources.length > 0 && (
        <div className="mt-2 flex gap-1.5">
          <select data-testid="select-figure-add" aria-label={FIGURE_TEXTS.add} className={selectClass} value={pick} onChange={(e) => setPick(Number(e.currentTarget.value))}>
            {sources.map((s, k) => (
              <option key={`${s.canvasId}|${s.frameId ?? ""}`} value={k}>
                {s.frameId ? ` › ${s.name}` : s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            data-testid="button-figure-add"
            className="h-7 rounded-md border border-im-line bg-im-surface px-2.5 text-xs text-im-ink hover:bg-im-hover"
            onClick={() => {
              const s = sources[pick] ?? sources[0]!;
              choice.choose([...figures, newFigure(uuidv7(), s.canvasId, s.frameId)]);
            }}
          >
            {FIGURE_TEXTS.addButton}
          </button>
        </div>
      )}
    </div>
  );
}
