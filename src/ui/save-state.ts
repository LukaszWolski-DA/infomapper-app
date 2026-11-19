// The page's save state (slice 30, Q6, L5, D-84 as proposed): every write the page sends, as one store the top bar's
// indicator reads ("Saving…", "Saved", "Not saved"). Nothing above the canvas re-renders but the indicator, and nothing
// here reads layout. Writes come in through `reportSave`, called where they leave the page: the save chain
// (`rowSaves`, every row's save), `useAction`'s `run` (creates and the other writes, not the previews it reads), undo and
// redo, the canvas's own writes (its action props, wrapped once) and the import's upload.
//
// - While a write is on its way: "Saving…".
// - When the last one is answered and none failed since the last success: "Saved", fully shown about 1.8 s, then faded
//   over 0.6 s.
// - A refused write (any refusal but a cut save, which a refusal before it already explained), a thrown one, or one
//   without an answer after 30 s: "Not saved", until a later write succeeds. Its tooltip says why and what to do, by the
//   kind of write and of failure (L5); the toasts and D-66's marks stay as they are.

import { BUSY_MESSAGE } from "@/domain/errors";

/** What kind of write, for the tooltip: a row's save (a field, a switch), a create or other change, the canvas's own. */
export type SaveKind = "row" | "change" | "canvas";
export type SaveFailure = { kind: SaveKind; reason: "refused" | "silent" | "busy"; message: string };
export type SavePhase = "idle" | "saving" | "saved" | "fading" | "failed";
export interface SaveSnapshot {
  phase: SavePhase;
  failure: SaveFailure | null;
}

/** How long a write may stay unanswered before it shows as "Not saved" (L5). */
export const NO_ANSWER_MS = 30_000;
/** "Saved" fully shown, then the fade (the prototype's 1.8 s and 0.6 s). */
export const SAVED_MS = 1_800;
export const FADE_MS = 600;
/** The busy refusal's text (the workspace's lock not free, L7): its own tooltip. */
export const BUSY_TEXT = BUSY_MESSAGE;

const IDLE: SaveSnapshot = { phase: "idle", failure: null };

class SaveState {
  private pending = 0;
  private silent = 0;
  private failure: SaveFailure | null = null;
  private shown: SaveSnapshot = IDLE;
  private listeners = new Set<() => void>();
  private timers: ReturnType<typeof setTimeout>[] = [];

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = (): SaveSnapshot => this.shown;
  getServerSnapshot = (): SaveSnapshot => IDLE;

  private show(next: SaveSnapshot): void {
    if (next.phase === this.shown.phase && next.failure === this.shown.failure) return;
    this.shown = next;
    for (const l of this.listeners) l();
  }
  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }
  private settle(): void {
    if (this.failure && (this.pending === 0 || this.silent > 0)) return this.show({ phase: "failed", failure: this.failure });
    if (this.pending > 0) return this.show({ phase: "saving", failure: null });
    this.show({ phase: "saved", failure: null });
    this.clearTimers();
    this.timers.push(
      setTimeout(() => this.pending === 0 && !this.failure && this.show({ phase: "fading", failure: null }), SAVED_MS),
      setTimeout(() => this.pending === 0 && !this.failure && this.show(IDLE), SAVED_MS + FADE_MS),
    );
  }

  /** Follows one write: its promise is handed back unchanged. */
  report<T>(work: Promise<T>, kind: SaveKind): Promise<T> {
    this.pending++;
    this.clearTimers();
    this.settle();
    let late = false;
    const timer = setTimeout(() => {
      late = true;
      this.silent++;
      this.failure = { kind, reason: "silent", message: "" };
      this.settle();
    }, NO_ANSWER_MS);
    const done = (failure: SaveFailure | null) => {
      clearTimeout(timer);
      if (late) this.silent--;
      this.pending--;
      // a later success clears an earlier failure; a cut save (code `cut`) says nothing new
      if (failure) this.failure = failure;
      else if (failure === null) this.failure = null;
      this.settle();
    };
    return work.then(
      (value) => {
        const refusal = refusalOf(value);
        if (refusal === "cut") done(this.failure);
        else done(refusal ? { kind, reason: refusal.message === BUSY_TEXT ? "busy" : "refused", message: refusal.message } : null);
        return value;
      },
      (e: unknown) => {
        done({ kind, reason: "silent", message: "" });
        throw e;
      },
    );
  }

  /** For tests: back to nothing on its way. */
  reset(): void {
    this.clearTimers();
    this.pending = 0;
    this.silent = 0;
    this.failure = null;
    this.show(IDLE);
  }
}

/** A write's answer as a refusal: `{ ok: false, code, message }`; `cut` for a save not sent. */
function refusalOf(value: unknown): { message: string } | "cut" | null {
  if (!value || typeof value !== "object" || !("ok" in value) || (value as { ok: unknown }).ok !== false) return null;
  const { code, message } = value as { code?: string; message?: string };
  return code === "cut" ? "cut" : { message: message ?? "" };
}

/** The page's one save state (one per browser tab). */
export const saveState = new SaveState();

/** Follows a write (see the file's head). */
export const reportSave = <T>(work: Promise<T>, kind: SaveKind): Promise<T> => saveState.report(work, kind);

/** Every function of `writes` followed as a write of `kind` (the canvas's action props, wrapped once). */
export function reportedAll<T extends object>(writes: T, kind: SaveKind): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(writes)) out[k] = typeof v === "function" ? (...args: unknown[]) => reportSave(Promise.resolve((v as (...a: unknown[]) => unknown)(...args)), kind) : v;
  return out as T;
}

const NO_ANSWER = "the server did not answer.";
const AGAIN = "If this repeats, check your connection and reload the page.";

/** The tooltip of "Not saved" (L5): why, and what to do, by the kind of write and of failure. */
export function failureText(f: SaveFailure): string {
  if (f.reason === "busy") return `Your last change was not saved: ${BUSY_TEXT}`;
  const why = f.reason === "silent" ? NO_ANSWER : f.message;
  const then = f.kind === "canvas" ? "It was taken back here; make it again." : f.kind === "row" ? "A text you typed is kept in its field." : "Make it again.";
  return `Your last change was not saved: ${why} ${then}${f.reason === "silent" ? ` ${AGAIN}` : ""}`;
}
