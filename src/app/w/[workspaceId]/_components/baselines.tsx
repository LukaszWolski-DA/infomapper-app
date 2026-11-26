"use client";

// The workspace home's Baselines tab (slice 35, D-87; the prototype's `renderWsHome` "baselines", `renameBaseline`,
// `askDeleteBaseline`, `compareBaseline`): the intro, the "New baseline" box (owners, admins, modelers), the list newest
// first with its times in the browser's time zone (Łukasz's answer 1) and the stored counts, and the three dialogs. The
// comparison runs on the server; the filter and the kind narrow it here. Baselines are outside undo: no Undo in a toast.
// Slice 36 (F1): the modules' parts come as `extensions` from the composition root (`src/compose/baselines-ui.ts`):
// InfoDocumenter's "New document from it" in each row, "Make a document" in Compare, the delete dialog's documents' line.

import { Dialog as DialogPrimitive } from "radix-ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { compareBaselineAction, createBaselineAction, deleteBaselineAction, renameBaselineAction, type CompareAnswer, type CompareSide } from "@/app/_actions/baselines";
import { useAction } from "@/app/_components/use-action";
import { useToast } from "@/ui/components/toast";
import { CHANGE_KINDS, filterChanges, ITEM_KINDS, type ItemKind } from "@/domain/baseline/compare";
import { BASELINE_NAME_MAX, BASELINE_NOTE_MAX, BASELINE_GONE_MESSAGE, NAME_REQUIRED_MESSAGE } from "@/domain/baseline/names";
import { COMPARE_WORDS, whatChanged } from "@/domain/baseline/words";
import { NO_BASELINE_EXTENSIONS, type BaselineExtensions } from "@/compose/baselines-ui";
import { cn } from "@/ui/lib/utils";
import { FIELD_LABEL } from "@/ui/components/field";
import { Select } from "@/ui/components/select";
import { inputVariants, textareaVariants } from "@/ui/components/input";
import { buttonVariants } from "@/ui/components/button";

const W = COMPARE_WORDS.en;

export const BASELINE_TEXTS = {
  intro:
    "A baseline freezes the model (entities, attributes, sources, mappings, relationships, requirements) with a name, e.g. for a sign-off. Compare it with today, or produce documentation exactly as it was.",
  none: "No baselines yet.",
  created: (name: string) => `Created the baseline ${name}.`,
  renamed: (from: string, to: string) => `Renamed the baseline ${from} to ${to}.`,
  noteChanged: (name: string) => `Changed the note of the baseline ${name}.`,
  deleted: (name: string) => `Deleted the baseline ${name}.`,
} as const;

/** A baseline as the tab lists it (the row's columns the page needs, the creator's name). */
export interface BaselineItem {
  id: string;
  version: number;
  name: string;
  note: string | null;
  created_at: string;
  by: string;
  entity_count: number;
  mapping_count: number;
  requirement_count: number;
}

const two = (n: number) => String(n).padStart(2, "0");
/** "yyyy-mm-dd hh:mm" in the browser's time zone. */
function minuteText(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}
const noStore = () => () => undefined;
/** Whether the browser's time zone is known: false on the server and during hydration, true after it. */
const useLocalTime = () => useSyncExternalStore(noStore, () => true, () => false);
/** The times' formatter for text the browser alone draws (the dialogs open after a click): "" until the browser's time is known. */
function useMinute(): (iso: string) => string {
  const local = useLocalTime();
  return (iso) => (local ? minuteText(iso) : "");
}
// as wide as any time (tabular figures), so nothing moves when the time replaces it
const TIME_PLACEHOLDER = "0000-00-00 00:00";
/**
 * A time in the list: the browser's time once known; until then (the server's HTML, hydration) nothing visible in its place,
 * an invisible placeholder of the same width, never a time in another zone.
 */
function Minute({ iso }: { iso: string }) {
  const local = useLocalTime();
  return local ? (
    <span className="tabular-nums" data-testid="baseline-time">
      {minuteText(iso)}
    </span>
  ) : (
    <span className="invisible tabular-nums" aria-hidden="true" data-testid="baseline-time-pending">
      {TIME_PLACEHOLDER}
    </span>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

// slice 37 (step 5): the shared buttons and fields, each keeping its padding
const smallBtn = cn(buttonVariants({ size: "sm" }), "px-[9px] text-xs");
const btn = cn(buttonVariants(), "px-3");
// the app's primary buttons (`primaryClass`, `src/app/_panels/fields.tsx`) use the logical colour, the prototype's `.pri` the
// mapping colour: the app's own, as every primary button of the app
const priBtn = cn(buttonVariants({ variant: "primary" }), "px-3");
const smallPriBtn = cn(buttonVariants({ variant: "primary", size: "sm" }), "px-[9px] text-xs");
const textInput = cn(inputVariants(), "w-auto px-2");
const fieldInput = cn(inputVariants(), "px-2");
const label = FIELD_LABEL;

export function BaselinesTab({
  workspaceId,
  workspaceName,
  baselines,
  rights,
  extensions = NO_BASELINE_EXTENSIONS,
}: {
  workspaceId: string;
  workspaceName: string;
  baselines: BaselineItem[];
  rights: { create: boolean; rename: boolean; delete: boolean };
  /** Slice 36: what the modules add (none without them). */
  extensions?: BaselineExtensions;
}) {
  const minute = useMinute();
  const opener = useOpener();
  const row = extensions.rowAction;
  const [renaming, setRenaming] = useState<BaselineItem | null>(null);
  const [deleting, setDeleting] = useState<BaselineItem | null>(null);
  const [comparing, setComparing] = useState<BaselineItem | null>(null);
  return (
    <div data-testid="tab-body-baselines">
      <p className="mt-3.5 text-im-ink-2" data-testid="text-baselines-intro">
        {BASELINE_TEXTS.intro}
      </p>
      {rights.create && <NewBaselineBox workspaceId={workspaceId} />}
      {baselines.length ? (
        <div className={rights.create ? "" : "mt-3"} data-testid="list-baselines">
          {baselines.map((b) => (
            <div
              key={b.id}
              data-testid="baseline-row"
              data-id={b.id}
              className="mb-2.5 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 [overflow-wrap:anywhere] gap-y-1.5 rounded-lg bg-im-surface px-3.5 py-3 shadow-[0_0_0_1px_var(--im-line)]"
            >
              <div>
                <div className="font-semibold" data-testid="baseline-name">
                  {b.name}
                </div>
                <div className="text-xs text-im-ink-3" data-testid="baseline-meta">
                  <Minute iso={b.created_at} /> by {b.by}
                  {b.note ? ` · ${b.note}` : ""} · {plural(b.entity_count, "entity", "entities")}, {plural(b.mapping_count, "mapping")}, {plural(b.requirement_count, "requirement")}
                </div>
              </div>
              <div />
              <div className="col-span-full flex flex-wrap gap-1.5">
                <button type="button" className={smallBtn} data-testid="button-baseline-compare" onClick={() => setComparing(b)}>
                  Compare…
                </button>
                {row && (
                  <button
                    type="button"
                    className={smallBtn}
                    data-testid={row.testId}
                    disabled={opener.pending}
                    onClick={() => void opener.open(() => row.run({ workspaceId, baselineId: b.id }))}
                  >
                    {row.label}
                  </button>
                )}
                {rights.rename && (
                  <button type="button" className={smallBtn} data-testid="button-baseline-rename" onClick={() => setRenaming(b)}>
                    Rename
                  </button>
                )}
                {rights.delete && (
                  <button type="button" className={cn(smallBtn, "text-im-warn")} data-testid="button-baseline-delete" onClick={() => setDeleting(b)}>
                    Delete baseline
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-im-ink-3" data-testid="text-no-baselines">
          {BASELINE_TEXTS.none}
        </p>
      )}
      {renaming && <RenameDialog workspaceId={workspaceId} workspaceName={workspaceName} baseline={renaming} taken={minute(renaming.created_at)} onClose={() => setRenaming(null)} />}
      {deleting && <DeleteDialog workspaceId={workspaceId} workspaceName={workspaceName} baseline={deleting} documentsLine={extensions.deleteLines[deleting.id] ?? null} onClose={() => setDeleting(null)} />}
      {comparing && (
        <CompareDialog workspaceId={workspaceId} workspaceName={workspaceName} baseline={comparing} baselines={baselines} action={extensions.compareAction} onClose={() => setComparing(null)} />
      )}
    </div>
  );
}

/** Slice 36: a module's action that makes something and opens it (its answer's page), its refusal as a toast. */
function useOpener() {
  const { run, pending } = useAction();
  const router = useRouter();
  const open = async (action: () => ReturnType<NonNullable<BaselineExtensions["rowAction"]>["run"]>) => {
    const r = await run(action as never);
    if (r.ok) router.push((r.value as { href: string }).href);
    return r.ok;
  };
  return { open, pending };
}

function NewBaselineBox({ workspaceId }: { workspaceId: string }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const { run, pending } = useAction();
  const create = async () => {
    if (!name.trim()) {
      nameRef.current?.focus();
      toast(NAME_REQUIRED_MESSAGE, "refusal");
      return;
    }
    const r = await run(() => createBaselineAction({ workspaceId, name, note }), (v) => BASELINE_TEXTS.created(v.name));
    if (r.ok) {
      setName("");
      setNote("");
    } else nameRef.current?.focus();
  };
  return (
    <div className="mb-[18px] mt-3 rounded-lg bg-im-surface px-4 py-3.5 shadow-[0_0_0_1px_var(--im-line)]" data-testid="box-new-baseline">
      <h4 className="m-0 mb-1 text-[13.5px] font-semibold">New baseline</h4>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <input
          ref={nameRef}
          type="text"
          aria-label="Name"
          maxLength={BASELINE_NAME_MAX}
          placeholder="Name, e.g. Stage 2 sign-off"
          className={cn(textInput, "min-w-[220px] flex-1")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="input-baseline-name"
        />
        <input
          type="text"
          aria-label="Note (optional)"
          maxLength={BASELINE_NOTE_MAX}
          placeholder="Note (optional)"
          className={cn(textInput, "min-w-[220px] flex-[2]")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          data-testid="input-baseline-note"
        />
        <button type="submit" className={smallPriBtn} disabled={pending} data-testid="button-create-baseline">
          Create baseline
        </button>
      </form>
    </div>
  );
}

/** The prototype's `#wsmodal` (760 px, as every one of its dialogs): a subtitle and a title with ✕, the body, a footer. */
function WsModal({ subtitle, title, testId, onClose, footer, children }: { subtitle: string; title: string; testId: string; onClose: () => void; footer: ReactNode; children: ReactNode }) {
  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-[rgba(15,20,30,.45)]" />
        <DialogPrimitive.Content
          className={`fixed left-1/2 top-1/2 z-[90] flex max-h-[90vh] w-[min(760px,96vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-im-surface text-im-ink [overflow-wrap:anywhere] shadow-[0_0_0_1px_var(--im-line),0_24px_60px_-20px_rgba(0,0,0,.45)] outline-none`}
          data-testid={testId}
          aria-describedby={undefined}
        >
          <div className="flex items-start gap-2.5 border-b border-im-line px-4 pb-2.5 pt-3.5">
            <div className="min-w-0 flex-1">
              <div className="text-[11.5px] text-im-ink-3" data-testid="text-dialog-subtitle">
                {subtitle}
              </div>
              <DialogPrimitive.Title className="text-[15px] font-semibold">{title}</DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close className="size-7 rounded-md text-im-ink-2 hover:bg-im-hover" aria-label="Close" title="Close (Esc)">
              ✕
            </DialogPrimitive.Close>
          </div>
          {/* a long unbroken name (a source's technical names) breaks anywhere, so nothing is wider than the dialog: a table
              wider than the body put a horizontal scroll bar over the list's last line (step 5, Łukasz's acceptance) */}
          <div className="max-h-[66vh] overflow-auto px-[18px] py-3.5 text-[13px]" data-testid="dialog-body">
            {children}
          </div>
          <div className="flex items-center gap-2 border-t border-im-line px-4 py-2.5 text-xs text-im-ink-3" data-testid="dialog-footer">
            <span className="flex-1" />
            {footer}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function RenameDialog({ workspaceId, workspaceName, baseline: b, taken, onClose }: { workspaceId: string; workspaceName: string; baseline: BaselineItem; taken: string; onClose: () => void }) {
  const [name, setName] = useState(b.name);
  const [note, setNote] = useState(b.note ?? "");
  const nameRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const { saveRow, pending } = useAction();
  const save = async () => {
    const n = name.trim();
    const t = note.trim();
    if (!n) {
      nameRef.current?.focus();
      toast(NAME_REQUIRED_MESSAGE, "refusal");
      return;
    }
    // nothing changed: the dialog closes and nothing is written
    if (n === b.name && t === (b.note ?? "")) return onClose();
    const r = await saveRow(
      b,
      (v) => renameBaselineAction({ workspaceId, baselineId: b.id, expectedVersion: v, name: n, note: t }),
      (v) => (v.renamed ? BASELINE_TEXTS.renamed(b.name, v.name) : BASELINE_TEXTS.noteChanged(v.name)),
    );
    if (r.ok || r.code === "not_found") onClose();
    else nameRef.current?.focus();
  };
  return (
    <WsModal
      subtitle={`${workspaceName} · baseline`}
      title={`Rename “${b.name}”`}
      testId="dialog-rename-baseline"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btn} onClick={onClose} data-testid="button-cancel-rename-baseline">
            Cancel
          </button>
          <button type="submit" form="form-rename-baseline" className={priBtn} disabled={pending} data-testid="button-save-rename-baseline">
            Save
          </button>
        </>
      }
    >
      <form
        id="form-rename-baseline"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <p className="my-[1em] text-im-ink-2" data-testid="text-rename-baseline">
          Only the name and the note change. What the baseline holds stays as it was taken on {taken}.
        </p>
        <div className="mt-3">
          <label htmlFor="blr-name" className={label}>
            Name
          </label>
          <input
            id="blr-name"
            ref={nameRef}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            maxLength={BASELINE_NAME_MAX}
            className={fieldInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="input-rename-baseline-name"
          />
        </div>
        <div className="mt-3">
          <label htmlFor="blr-note" className={label}>
            Note (optional)
          </label>
          <textarea
            id="blr-note"
            rows={3}
            maxLength={BASELINE_NOTE_MAX}
            className={textareaVariants()}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            data-testid="input-rename-baseline-note"
          />
        </div>
      </form>
    </WsModal>
  );
}

function DeleteDialog({
  workspaceId,
  workspaceName,
  baseline: b,
  documentsLine,
  onClose,
}: {
  workspaceId: string;
  workspaceName: string;
  baseline: BaselineItem;
  /** Slice 36: how many documents are made from it, counted on the server (a number only), or null. */
  documentsLine: string | null;
  onClose: () => void;
}) {
  const { saveRow, pending } = useAction();
  const remove = async () => {
    const r = await saveRow(b, (v) => deleteBaselineAction({ workspaceId, baselineId: b.id, expectedVersion: v }), BASELINE_TEXTS.deleted(b.name), { deletes: true });
    if (r.ok || r.code === "not_found") onClose();
  };
  return (
    <WsModal
      subtitle={`${workspaceName} · baseline`}
      title={`Delete the baseline “${b.name}”?`}
      testId="dialog-delete-baseline"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btn} onClick={onClose} data-testid="button-cancel-delete-baseline">
            Cancel
          </button>
          <button type="button" className={cn(btn, "text-im-warn")} disabled={pending} onClick={() => void remove()} data-testid="button-confirm-delete-baseline">
            Delete baseline
          </button>
        </>
      }
    >
      <p className="my-[1em]" data-testid="text-delete-baseline">
        It cannot be brought back here.
      </p>
      {documentsLine && (
        <p className="my-[1em]" data-testid="text-delete-baseline-documents">
          {documentsLine}
        </p>
      )}
    </WsModal>
  );
}

const GROUP_CLASS = { added: "text-im-map", changed: "text-im-logical", removed: "text-im-warn" } as const;

function CompareDialog({
  workspaceId,
  workspaceName,
  baseline: b,
  baselines,
  action,
  onClose,
}: {
  workspaceId: string;
  workspaceName: string;
  baseline: BaselineItem;
  baselines: BaselineItem[];
  /** Slice 36: a module's "Make a document" (B4.6), or null. */
  action: BaselineExtensions["compareAction"];
  onClose: () => void;
}) {
  const opener = useOpener();
  const minute = useMinute();
  const router = useRouter();
  const toast = useToast();
  const { run } = useAction();
  const [other, setOther] = useState<string>("now");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ItemKind | "">("");
  const [answer, setAnswer] = useState<{ for: string; value: CompareAnswer } | null>(null);
  const others = baselines.filter((x) => x.id !== b.id);

  // one request per "Compared with"; an answer for an earlier choice is dropped
  useEffect(() => {
    let current = true;
    void run(() => compareBaselineAction({ workspaceId, baselineId: b.id, otherId: other === "now" ? null : other }), undefined, { read: true, quiet: true }).then((r) => {
      if (!current) return;
      if (r.ok) setAnswer({ for: other, value: r.value });
      else {
        toast(r.code === "not_found" ? BASELINE_GONE_MESSAGE : r.message, "refusal");
        onClose();
        router.refresh();
      }
    });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one request per choice of the baseline and "Compared with"
  }, [workspaceId, b.id, other]);

  const shown = answer?.for === other ? answer.value : null;
  const changes = useMemo(() => (shown ? filterChanges(shown.changes, query, kind || null) : []), [shown, query, kind]);
  const side = (s: CompareSide) => (s ? `“${s.name}” (${minute(s.created_at)})` : "now");
  const all = shown?.changes.length ?? 0;

  return (
    <WsModal
      subtitle={workspaceName}
      title={`Compare “${b.name}”`}
      testId="dialog-compare-baseline"
      onClose={onClose}
      footer={
        <>
          {action && (
            <button
              type="button"
              className={btn}
              title={action.title}
              data-testid={action.testId}
              disabled={opener.pending}
              onClick={() => void opener.open(() => action.run({ workspaceId, olderId: b.id, newerId: other === "now" ? null : other }))}
            >
              {action.label}
            </button>
          )}
          <button type="button" className={btn} onClick={onClose} data-testid="button-close-compare">
            Close
          </button>
        </>
      }
    >
      <div className="mb-2.5 flex flex-wrap items-end gap-2.5">
        <div className="flex-[0_0_260px]">
          <label htmlFor="cmp-with" className={label}>
            Compared with
          </label>
          <Select id="cmp-with" value={other} onChange={(e) => setOther(e.target.value)} data-testid="select-compare-with">
            <option value="now">Now (the live model)</option>
            {others.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} ({minute(x.created_at)})
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-0 flex-[1_1_200px]">
          <label htmlFor="cmp-q" className={label}>
            Filter
          </label>
          <input id="cmp-q" type="search" placeholder="A name, e.g. Customer or cust_no" className={fieldInput} value={query} onChange={(e) => setQuery(e.target.value)} data-testid="input-compare-filter" />
        </div>
        <div className="flex-[0_0_160px]">
          <label htmlFor="cmp-kind" className={label}>
            Kind
          </label>
          <Select id="cmp-kind" value={kind} onChange={(e) => setKind(e.target.value as ItemKind | "")} data-testid="select-compare-kind">
            <option value="">All kinds</option>
            {ITEM_KINDS.map((k) => (
              <option key={k} value={k}>
                {W.kinds[k]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div data-testid="compare-list" aria-busy={!shown}>
        {!shown ? (
          <p className="my-[1em] text-im-ink-3">Comparing…</p>
        ) : (
          <>
            <p className="my-[1em]" data-testid="text-compare-line">
              {all ? (
                <>
                  {all} change{all > 1 ? "s" : ""} from <b>{side(shown.older)}</b> to <b>{side(shown.newer)}</b>
                  {changes.length !== all ? `; ${changes.length} shown by the filter` : ""}.
                </>
              ) : (
                <>
                  No changes from <b>{side(shown.older)}</b> to <b>{side(shown.newer)}</b>.
                </>
              )}
            </p>
            {CHANGE_KINDS.map((ch) => {
              const list = changes.filter((c) => c.change === ch);
              if (!list.length) return null;
              return (
                <div key={ch} data-testid={`compare-group-${ch}`}>
                  <h4 className={`mb-1.5 mt-3.5 text-[13px] font-semibold ${GROUP_CLASS[ch]}`}>
                    {W.groups[ch]} ({list.length})
                  </h4>
                  <table className="w-full border-collapse text-[12.5px]">
                    <thead>
                      <tr>
                        {["Kind", "Item", "What changed"].map((h) => (
                          <th key={h} className="border-b border-im-line px-2 py-1.5 text-left align-top text-[11.5px] font-semibold text-im-ink-3">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((c) => (
                        <tr key={`${c.kind}:${c.id}`} data-testid="compare-row">
                          <td className="border-b border-im-line px-2 py-1.5 align-top">{W.kinds[c.kind]}</td>
                          <td className="border-b border-im-line px-2 py-1.5 align-top font-mono" data-testid="compare-item">
                            {c.label}
                          </td>
                          <td className="border-b border-im-line px-2 py-1.5 align-top" data-testid="compare-what">
                            {whatChanged(c, W)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
            {all > 0 && !changes.length && (
              <p className="my-[1em] text-im-ink-3" data-testid="text-compare-nothing">
                Nothing matches the filter.
              </p>
            )}
          </>
        )}
      </div>
    </WsModal>
  );
}
