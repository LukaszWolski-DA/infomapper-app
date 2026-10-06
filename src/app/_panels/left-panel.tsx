"use client";

// The left panel (prototype #side): Model and Sources tabs, search over names and fields, “Only what this project
// uses”, “Only on this canvas”, folding groups with sticky headers, collapse all and expand all (D-35). A click on an item places it in a free spot of the view (or shows its card);
// dragging it onto the canvas places it there. Model tab, for those who may edit: “+” per concept, “New concept”,
// rename a concept by double-click, and its ⋯ menu (D-46, D-47). Sources tab: “New source table”.
// The Requirements tab comes with requirements.

import { useContext, useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { createConceptAction, createEntityAction, renameConceptAction } from "@/app/_actions/model";
import { useAction } from "@/app/_components/use-action";
import { DotsIcon, itemClass, menuClass, sectionClass } from "@/app/w/[workspaceId]/p/[projectId]/_components/canvas-menu";
import { readPreference, writePreference } from "@/canvas/CanvasProvider";
import { CanvasUiCtx, CARD_DRAG_TYPE, type CardTarget } from "@/canvas/context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/components/dropdown-menu";
import { useToast } from "@/ui/components/toast";
import { DeleteConceptDialog } from "./delete-concept-dialog";
import { NewSourceTableDialog } from "./new-source-table-dialog";
import { usePanels } from "./panels-context";
import {
  allGroups,
  conceptGroup,
  filterConcepts,
  filterSystems,
  isOpen,
  schemaGroup,
  systemGroup,
  type Presence,
  type TreeConcept,
  type TreeData,
  type TreeFilter,
} from "./tree-data";

const SHUT_KEY = "infomapper:tree-shut";
const CANVAS_ONLY_KEY = "infomapper:tree-canvas-only";
const PROJECT_ONLY_KEY = "infomapper:tree-project-only";

type Tab = "model" | "sources";

export interface LeftPanelProps {
  workspaceId: string;
  canvasId: string;
  tree: TreeData;
  /** Owner, admin or modeler in a workspace that is not archived. */
  editable: boolean;
}

export function LeftPanel({ workspaceId, canvasId, tree, editable }: LeftPanelProps) {
  const ui = useContext(CanvasUiCtx);
  const toast = useToast();
  const { run } = useAction();
  const { setNameFocus, setLastConcept } = usePanels();
  const [tab, setTab] = useState<Tab>("model");
  const [q, setQ] = useState("");
  const [canvasOnly, setCanvasOnly] = useState(false);
  const [projectOnly, setProjectOnly] = useState(false);
  const [shut, setShut] = useState<ReadonlySet<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [addingConcept, setAddingConcept] = useState(false);
  const [deleting, setDeleting] = useState<TreeConcept | null>(null);
  const [addingTable, setAddingTable] = useState(false);

  useEffect(() => {
    // Read once after mount: localStorage is not available on the server.
    let saved: string[] = [];
    try {
      saved = JSON.parse(readPreference(SHUT_KEY) ?? "[]") as string[];
    } catch {
      // a broken preference is ignored
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only preferences
    if (Array.isArray(saved)) setShut(new Set(saved.filter((k) => typeof k === "string")));
    if (readPreference(CANVAS_ONLY_KEY) === "1") setCanvasOnly(true);
    if (readPreference(PROJECT_ONLY_KEY) === "1") setProjectOnly(true);
  }, []);

  const filter: TreeFilter = { q, canvasOnly, projectOnly };
  const searching = !!q.trim();

  const saveShut = (next: Set<string>) => {
    writePreference(SHUT_KEY, JSON.stringify([...next]));
    setShut(next);
  };
  const fold = (key: string) => {
    if (searching) {
      toast("Clear the search to fold groups.");
      return;
    }
    const next = new Set(shut);
    if (!next.delete(key)) next.add(key);
    saveShut(next);
  };
  const unfold = (key: string) => {
    if (!shut.has(key)) return;
    const next = new Set(shut);
    next.delete(key);
    saveShut(next);
  };

  const onCanvasOnly = (on: boolean) => {
    writePreference(CANVAS_ONLY_KEY, on ? "1" : "0");
    setCanvasOnly(on);
  };
  const onProjectOnly = (on: boolean) => {
    writePreference(PROJECT_ONLY_KEY, on ? "1" : "0");
    setProjectOnly(on);
  };
  /** Collapse all and expand all: every group of the open tab. */
  const foldAll = (fold: boolean) => {
    const next = new Set(shut);
    for (const k of allGroups(tree, tab)) {
      if (fold) next.add(k);
      else next.delete(k);
    }
    saveShut(next);
  };

  /** A click: show the card that is here, else place the element in a free spot of the view. */
  const open = (target: CardTarget, cardId: string | null, rows: number) => {
    if (cardId) {
      ui.select({ t: "card", id: cardId });
      ui.centerOn(cardId);
    } else ui.place(target, rows);
  };

  async function addEntity(c: TreeConcept) {
    unfold(conceptGroup(c.id));
    const spot = ui.freeSpot();
    const result = await run(() => createEntityAction(workspaceId, { conceptId: c.id, placement: { canvasId, ...spot } }));
    if (!result.ok) return;
    setLastConcept(c.id);
    toast(`Created ${result.value.name} in ${c.name}. Type its name now; change the concept in the panel.`);
    const cardId = result.value.canvasItemId;
    if (cardId) {
      ui.select({ t: "card", id: cardId });
      setNameFocus(cardId);
    }
  }

  async function renameConcept(c: TreeConcept, name: string) {
    setRenaming(null);
    const trimmed = name.trim();
    if (!trimmed || trimmed === c.name) return;
    await run(() => renameConceptAction(workspaceId, { conceptId: c.id, expectedVersion: c.version, name: trimmed }));
  }

  async function createConcept(name: string) {
    setAddingConcept(false);
    const result = await run(() => createConceptAction(workspaceId, { name }));
    if (!result.ok) return;
    setLastConcept(result.value.conceptId);
    toast(`Created the concept ${name}. Use + next to it to add entities.`);
  }

  // ---- the Model tab ----
  const modelTree = () => {
    const groups = filterConcepts(tree.concepts, filter);
    if (!groups.length && !(editable && !searching)) return null;
    return (
      <>
        {groups.map(({ concept: c, items }) => {
          const key = conceptGroup(c.id);
          const opened = isOpen(shut, key, q);
          return (
            <div key={c.id} data-testid="tree-concept" data-concept-id={c.id}>
              <div className="group/head sticky top-0 z-[2] flex items-center bg-im-panel">
                {renaming === c.id ? (
                  <NameInput
                    initial={c.name}
                    label="Concept name"
                    saveOnBlur
                    onDone={(name) => (name === null ? setRenaming(null) : void renameConcept(c, name))}
                  />
                ) : (
                  <>
                    <GroupHead
                      open={opened}
                      count={items.length}
                      dot={<i className="size-2 flex-none rounded-[2px]" style={{ background: c.color }} />}
                      onClick={() => fold(key)}
                      onDoubleClick={editable ? () => setRenaming(c.id) : undefined}
                      testId="tree-concept-head"
                    >
                      {c.name}
                    </GroupHead>
                    {editable && (
                      <>
                        <button
                          type="button"
                          className={addClass}
                          title={`New entity in ${c.name}`}
                          aria-label={`New entity in ${c.name}`}
                          data-testid="button-concept-add"
                          onClick={() => void addEntity(c)}
                        >
                          +
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className={addClass}
                              title="Concept options"
                              aria-label={`Options for ${c.name}`}
                              data-testid="button-concept-menu"
                            >
                              <DotsIcon />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className={menuClass}
                            // the rename field takes the focus; the menu must not hand it back to its button
                            onCloseAutoFocus={(e) => e.preventDefault()}
                          >
                            <DropdownMenuLabel className={sectionClass}>{c.name}</DropdownMenuLabel>
                            <DropdownMenuItem className={itemClass} onSelect={() => void addEntity(c)}>
                              New entity in {c.name}
                            </DropdownMenuItem>
                            <DropdownMenuItem className={itemClass} onSelect={() => setRenaming(c.id)}>
                              Rename <kbd className="text-[11px] text-im-ink-3">Dbl-click</kbd>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-im-line" />
                            <DropdownMenuItem className={`${itemClass} text-im-warn`} onSelect={() => setDeleting(c)}>
                              Delete concept…
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </>
                )}
              </div>
              {opened &&
                (items.length ? (
                  items.map(({ item: e, hint }) => (
                    <TreeItem
                      key={e.id}
                      kind="ent"
                      name={e.name}
                      hint={hint}
                      meta={e.stereotype}
                      presence={e.presence}
                      dragData={{ target: { entityId: e.id }, rows: e.fields.length }}
                      onClick={() => open({ entityId: e.id }, e.cardId, e.fields.length)}
                    />
                  ))
                ) : (
                  <div className="py-1 pl-[30px] pr-3 pb-2 text-xs text-im-ink-3">
                    No entities yet.{editable ? " Use + to add one." : ""}
                  </div>
                ))}
            </div>
          );
        })}
        {editable && !searching && (
          <div className="px-2 py-2.5">
            {addingConcept ? (
              <NameInput
                initial=""
                label="New concept name"
                placeholder="Concept name, then Enter"
                onDone={(name) => (name?.trim() ? void createConcept(name.trim()) : setAddingConcept(false))}
              />
            ) : (
              <button type="button" className={smallButton} data-testid="button-new-concept" onClick={() => setAddingConcept(true)}>
                New concept
              </button>
            )}
          </div>
        )}
      </>
    );
  };

  // ---- the Sources tab ----
  const newTable = editable && !searching && (
    <div className="px-2 py-2.5">
      <button type="button" className={smallButton} data-testid="button-new-source-table" onClick={() => setAddingTable(true)}>
        New source table
      </button>
    </div>
  );
  const sourceTree = () => {
    const systems = filterSystems(tree.systems, filter);
    if (!systems.length) return newTable || null;
    return [...systems.map(({ system: s, total, schemas }) => {
      const key = systemGroup(s.id);
      return (
        <div key={s.id} data-testid="tree-system">
          <GroupHead
            open={isOpen(shut, key, q)}
            count={total}
            dot={<i className="size-2 flex-none rounded-[2px] bg-im-physical" />}
            onClick={() => fold(key)}
            sticky
            testId="tree-system-head"
          >
            {s.name}
          </GroupHead>
          {isOpen(shut, key, q) &&
            schemas.map(({ name, items }) => {
              const sub = schemaGroup(s.id, name);
              return (
                <div key={name}>
                  <button
                    type="button"
                    className={`sticky top-7 z-[1] flex w-full items-center gap-1.5 bg-im-panel py-[5px] pl-[18px] pr-1.5 pb-[3px] text-left font-mono text-[11px] text-im-ink-3 hover:text-im-ink`}
                    aria-expanded={isOpen(shut, sub, q)}
                    data-testid="tree-schema-head"
                    onClick={() => fold(sub)}
                  >
                    <Chevron open={isOpen(shut, sub, q)} />
                    <span>{name}</span>
                    <span className="ml-auto font-sans">{items.length}</span>
                  </button>
                  {isOpen(shut, sub, q) &&
                    items.map(({ item: t, hint }) => (
                      <TreeItem
                        key={t.id}
                        kind="src"
                        name={t.name}
                        hint={hint}
                        meta={`${t.fields.length} cols`}
                        presence={t.presence}
                        dragData={{ target: { sourceTableId: t.id }, rows: t.fields.length }}
                        onClick={() => open({ sourceTableId: t.id }, t.cardId, t.fields.length)}
                      />
                    ))}
                </div>
              );
            })}
        </div>
      );
    }), <div key="new-table">{newTable}</div>];
  };

  const content = tab === "model" ? modelTree() : sourceTree();

  return (
    <>
      <div className="flex gap-0.5 px-2.5 pt-2.5" role="tablist">
        {(["model", "sources"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            data-testid={`tab-${t}`}
            onClick={() => setTab(t)}
            className="h-[30px] flex-1 rounded-t-md border-b-2 border-transparent text-[12.5px] font-medium text-im-ink-3 aria-selected:border-im-ink aria-selected:text-im-ink"
          >
            {t === "model" ? "Model" : "Sources"}
          </button>
        ))}
      </div>
      <div className="relative m-2.5">
        <svg viewBox="0 0 16 16" className="pointer-events-none absolute left-[9px] top-2 size-4 fill-none stroke-im-ink-3 stroke-[1.6]" aria-hidden>
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5l3.5 3.5" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search names and fields"
          autoComplete="off"
          aria-label="Search names and fields"
          data-testid="input-tree-search"
          className="h-8 w-full rounded-[7px] border border-im-line bg-im-surface pl-[30px] pr-2.5 outline-none focus:border-im-logical"
        />
      </div>
      <label className="mx-3 mb-1.5 flex items-center gap-2 text-xs text-im-ink-2">
        <input type="checkbox" checked={projectOnly} onChange={(e) => onProjectOnly(e.target.checked)} data-testid="check-project-only" />
        Only what this project uses
      </label>
      <div className="mb-1 ml-3 mr-2 flex items-center gap-1">
        <label className="flex items-center gap-2 text-xs text-im-ink-2">
          <input type="checkbox" checked={canvasOnly} onChange={(e) => onCanvasOnly(e.target.checked)} data-testid="check-canvas-only" />
          Only on this canvas
        </label>
        <span className="flex-1" />
        <button type="button" className={barButton} title="Collapse all groups" aria-label="Collapse all groups" data-testid="button-collapse-all" onClick={() => foldAll(true)}>
          <svg viewBox="0 0 16 16" className={barIcon} aria-hidden>
            <path d="M4 6l4-3 4 3M4 13l4-3 4 3" />
          </svg>
        </button>
        <button type="button" className={barButton} title="Expand all groups" aria-label="Expand all groups" data-testid="button-expand-all" onClick={() => foldAll(false)}>
          <svg viewBox="0 0 16 16" className={barIcon} aria-hidden>
            <path d="M4 3l4 3 4-3M4 10l4 3 4-3" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-1.5 pb-4" data-testid="tree">
        {content ?? (
          <p className="p-3 text-im-ink-3">
            {searching ? `Nothing matches “${q}”.` : canvasOnly ? "Nothing of this kind on this canvas yet." : "Nothing here yet."}
          </p>
        )}
      </div>
      <div className="border-t border-im-line px-3 py-2.5 text-[11.5px] text-im-ink-3">
        Drag onto the canvas, or click to add. A filled dot means it is on this canvas, a ring means it is on another one.
      </div>
      {addingTable && <NewSourceTableDialog workspaceId={workspaceId} systems={tree.systems.map((s) => s.name)} onClose={() => setAddingTable(false)} />}
      {deleting && (
        <DeleteConceptDialog
          workspaceId={workspaceId}
          concept={deleting}
          others={tree.concepts.filter((c) => c.id !== deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}

const addClass =
  "grid size-[22px] flex-none place-items-center rounded-[5px] mr-1 text-[15px] leading-none text-im-ink-3 opacity-0 hover:bg-im-hover hover:text-im-logical focus-visible:opacity-100 group-hover/head:opacity-100 data-[state=open]:opacity-100";
const barButton = "grid size-7 place-items-center rounded-md text-im-ink-3 hover:bg-im-hover hover:text-im-ink";
const barIcon = "size-4 fill-none stroke-current stroke-[1.6]";
const smallButton = "h-[26px] rounded-md border border-im-line bg-im-surface px-[9px] text-xs text-im-ink hover:bg-im-hover";

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 16 16"
    aria-hidden
    className={`size-2.5 flex-none fill-none stroke-current stroke-[1.8] transition-transform duration-100 ${open ? "" : "-rotate-90"}`}
  >
    <path d="M4 6l4 4 4-4" />
  </svg>
);

function GroupHead({
  open,
  count,
  dot,
  children,
  onClick,
  onDoubleClick,
  sticky,
  testId,
}: {
  open: boolean;
  count: number;
  dot: ReactNode;
  children: ReactNode;
  onClick: () => void;
  onDoubleClick?: () => void;
  sticky?: boolean;
  testId: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      data-testid={testId}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`flex min-w-0 flex-1 items-center gap-[7px] bg-im-panel px-1.5 pb-[5px] pt-2 text-left text-[11.5px] text-im-ink-3 hover:text-im-ink ${sticky ? "sticky top-0 z-[2] w-full" : ""}`}
    >
      <Chevron open={open} />
      {dot}
      <span className="min-w-0 truncate">{children}</span>
      <span className="ml-auto text-[11px] tabular-nums text-im-ink-3">{count}</span>
    </button>
  );
}

const PRESENCE_TITLE: Record<Presence, string> = {
  here: "On this canvas. Click to show it.",
  elsewhere: "On another canvas. Click or drag to add it here too.",
  none: "Click or drag to add to the canvas",
};

function TreeItem({
  kind,
  name,
  hint,
  meta,
  presence,
  dragData,
  onClick,
}: {
  kind: "ent" | "src";
  name: string;
  hint: string | null;
  meta: string;
  presence: Presence;
  dragData: { target: CardTarget; rows: number };
  onClick: () => void;
}) {
  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData(CARD_DRAG_TYPE, JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = "copy";
  };
  const dot =
    presence === "here"
      ? kind === "ent"
        ? "bg-im-logical"
        : "bg-im-physical"
      : presence === "elsewhere"
        ? "shadow-[inset_0_0_0_1.5px_var(--im-ink-3)]"
        : "opacity-0";
  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      title={PRESENCE_TITLE[presence]}
      data-testid="tree-item"
      data-presence={presence}
      className="flex w-full cursor-grab items-center gap-2 rounded-md py-[5px] pl-3.5 pr-2 text-left hover:bg-im-hover"
    >
      <span className={`size-[7px] flex-none rounded-full ${dot}`} />
      <span className="min-w-0 flex-1">
        <span className={`block truncate ${kind === "src" ? "font-mono text-xs" : ""}`}>{name}</span>
        {hint && <span className="block truncate text-[11px] text-im-ink-3">{hint}</span>}
      </span>
      <span className="flex-none text-[11px] text-im-ink-3">{meta}</span>
    </button>
  );
}

/** An inline name field: Enter saves (onDone with the text), Escape cancels (onDone with null). */
function NameInput({
  initial,
  label,
  placeholder,
  saveOnBlur,
  onDone,
}: {
  initial: string;
  label: string;
  placeholder?: string;
  /** Leaving the field saves (rename); otherwise it cancels (new concept). */
  saveOnBlur?: boolean;
  onDone: (name: string | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const finished = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (name: string | null) => {
    if (finished.current) return;
    finished.current = true;
    onDone(name);
  };
  return (
    <input
      ref={ref}
      defaultValue={initial}
      aria-label={label}
      placeholder={placeholder}
      autoComplete="off"
      data-testid="input-tree-name"
      className="h-7 w-full rounded-md border border-im-logical bg-im-surface px-2 outline-none"
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") finish(e.currentTarget.value);
        else if (e.key === "Escape") finish(null);
      }}
      onBlur={(e) => finish(saveOnBlur ? e.currentTarget.value : null)}
    />
  );
}
