"use client";

// The workspace home's Baselines tab (slice 35, D-87; the prototype's `renderWsHome` "baselines", `renameBaseline`,
// `askDeleteBaseline`, `compareBaseline`): the intro, the "New baseline" box (owners, admins, modelers), the list newest
// first with its times in the browser's time zone (Łukasz's answer 1) and the stored counts, and the three dialogs. The
// comparison runs on the server; the filter and the kind narrow it here. Baselines are outside undo: no Undo in a toast.
// Slice 36's parts (a document from a baseline, "Make a document", the documents' line on delete) are not here.

import { Dialog as DialogPrimitive } from "radix-ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { compareBaselineAction, createBaselineAction, deleteBaselineAction, renameBaselineAction, type CompareAnswer, type CompareSide } from "@/app/_actions/baselines";
import { useAction } from "@/app/_components/use-action";
import { useToast } from "@/ui/components/toast";
import { CHANGE_KINDS, filterChanges, ITEM_KINDS, type ItemKind } from "@/domain/baseline/compare";
import { BASELINE_NAME_MAX, BASELINE_NOTE_MAX, BASELINE_GONE_MESSAGE, NAME_REQUIRED_MESSAGE } from "@/domain/baseline/names";
import { COMPARE_WORDS, whatChanged } from "@/domain/baseline/words";

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

const smallBtn = "h-[26px] rounded-md border border-im-line bg-im-surface px-[9px] text-xs text-im-ink hover:bg-im-hover disabled:opacity-50";
const btn = "h-8 rounded-md border border-im-line bg-im-surface px-3 text-im-ink hover:bg-im-hover disabled:opacity-50";
// the app's primary buttons (`primaryClass`, `src/app/_panels/fields.tsx`) use the logical colour, the prototype's `.pri` the
// mapping colour: the app's own, as every primary button of the app
const priBtn = "h-8 rounded-md border border-im-logical bg-im-logical px-3 font-medium text-im-surface disabled:opacity-50";
const smallPriBtn = "h-[26px] rounded-md border border-im-logical bg-im-logical px-[9px] text-xs font-medium text-im-surface disabled:opacity-50";
const textInput = "h-8 rounded-md border border-im-line bg-im-surface px-2 text-im-ink outline-none focus:border-im-logical";
const fieldInput = "min-h-8 w-full rounded-md border border-im-line bg-im-surface px-2 py-1.5 text-im-ink outline-none focus:border-im-logical";
const label = "mb-1 block text-[11.5px] text-im-ink-3";

export function BaselinesTab({
  workspaceId,
  workspaceName,
  baselines,
  rights,
}: {
  workspaceId: string;
  workspaceName: string;
  baselines: BaselineItem[];
  rights: { create: boolean; rename: boolean; delete: boolean };
}) {
  const minute = useMinute();
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
              className="mb-2.5 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 rounded-[10px] bg-im-surface px-3.5 py-3 shadow-[0_0_0_1px_var(--im-line)]"
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
                {rights.rename && (
                  <button type="button" className={smallBtn} data-testid="button-baseline-rename" onClick={() => setRenaming(b)}>
                    Rename
                  </button>
                )}
                {rights.delete && (
                  <button type="button" className={`${smallBtn} text-im-warn`} data-testid="button-baseline-delete" onClick={() => setDeleting(b)}>
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
      {deleting && <DeleteDialog workspaceId={workspaceId} workspaceName={workspaceName} baseline={deleting} onClose={() => setDeleting(null)} />}
      {comparing && <CompareDialog workspaceId={workspaceId} workspaceName={workspaceName} baseline={comparing} baselines={baselines} onClose={() => setComparing(null)} />}
    </div>
  );
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
    <div className="mb-[18px] mt-3 rounded-[10px] bg-im-surface px-4 py-3.5 shadow-[0_0_0_1px_var(--im-line)]" data-testid="box-new-baseline">
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
          className={`${textInput} min-w-[220px] flex-1`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="input-baseline-name"
        />
        <input
          type="text"
          aria-label="Note (optional)"
          maxLength={BASELINE_NOTE_MAX}
          placeholder="Note (optional)"
          className={`${textInput} min-w-[220px] flex-[2]`}
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
          className={`fixed left-1/2 top-1/2 z-[90] flex max-h-[90vh] w-[min(760px,96vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-im-surface text-im-ink shadow-[0_0_0_1px_var(--im-line),0_24px_60px_-20px_rgba(0,0,0,.45)] outline-none`}
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
          <div className="max-h-[66vh] overflow-auto px-[18px] py-3.5 text-[13px]">{children}</div>
          <div className="flex items-center gap-2 border-t border-im-line px-4 py-2.5 text-xs text-im-ink-3">
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
            className={`${fieldInput} min-h-[60px] resize-y`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            data-testid="input-rename-baseline-note"
          />
        </div>
      </form>
    </WsModal>
  );
}

function DeleteDialog({ workspaceId, workspaceName, baseline: b, onClose }: { workspaceId: string; workspaceName: string; baseline: BaselineItem; onClose: () => void }) {
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
          <button type="button" className={`${btn} text-im-warn`} disabled={pending} onClick={() => void remove()} data-testid="button-confirm-delete-baseline">
            Delete baseline
          </button>
        </>
      }
    >
      <p className="my-[1em]" data-testid="text-delete-baseline">
        It cannot be brought back here.
      </p>
    </WsModal>
  );
}

const GROUP_CLASS = { added: "text-im-map", changed: "text-im-logical", removed: "text-im-warn" } as const;

function CompareDialog({ workspaceId, workspaceName, baseline: b, baselines, onClose }: { workspaceId: string; workspaceName: string; baseline: BaselineItem; baselines: BaselineItem[]; onClose: () => void }) {
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
        <button type="button" className={btn} onClick={onClose} data-testid="button-close-compare">
          Close
        </button>
      }
    >
      <div className="mb-2.5 flex flex-wrap items-end gap-2.5">
        <div className="flex-[0_0_260px]">
          <label htmlFor="cmp-with" className={label}>
            Compared with
          </label>
          <select id="cmp-with" className={fieldInput} value={other} onChange={(e) => setOther(e.target.value)} data-testid="select-compare-with">
            <option value="now">Now (the live model)</option>
            {others.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} ({minute(x.created_at)})
              </option>
            ))}
          </select>
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
          <select id="cmp-kind" className={fieldInput} value={kind} onChange={(e) => setKind(e.target.value as ItemKind | "")} data-testid="select-compare-kind">
            <option value="">All kinds</option>
            {ITEM_KINDS.map((k) => (
              <option key={k} value={k}>
                {W.kinds[k]}
              </option>
            ))}
          </select>
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
