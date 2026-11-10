// A note's and a frame's saves on the canvas's queue after a refusal (slice 14a, F2, F3; D-66). The queue runs a row's
// writes one after the other; a refused one leaves the canvas's version of the row as it was, so a save waiting behind
// it would be sent with that old version and refused again, with a toast of its own. Like the panels' save chain
// (`src/ui/row-saves.ts`), a refusal that cuts (a stale version, a permission, the archive, a row not found, a locked
// organization) cuts the note's or frame's saves waiting behind it: they answer `cut` without being sent and without a
// toast. Only a note's saves (`useNotes.save`) and a frame's `updateFrame` record and check cuts; the canvas's other
// writes are sent as before (Łukasz, step 1 answer 2).
//
// A refusal that brings the fresh page is answered once that page's rows have been merged (as `afterPage` in
// `use-action.ts`), so a field reads the newest stored value and version; at most `FRESH_WAIT_MS` later.

/** Refusals after which the saves waiting behind are cut. */
export const CUTTING_REFUSALS: ReadonlySet<string> = new Set(["stale_version", "forbidden", "archived", "not_found", "locked"]);
/** Refusals whose answer brings the fresh page (`runCommand`, slice 13, F3); `locked` brings none. */
export const PAGE_REFUSALS: ReadonlySet<string> = new Set(["stale_version", "forbidden", "archived", "not_found"]);
/** The longest a refusal waits for its fresh page. */
export const FRESH_WAIT_MS = 3000;

/** What a note's or frame's save answers its caller: stored, or refused with the refusal's code (`cut` included). */
/** A canvas save's answer; a stored one may give the row's new version (a frame's, for its name's draft). */
export type CanvasSave = { ok: true; version?: number } | { ok: false; code: string };
export const CUT_SAVE: CanvasSave = { ok: false, code: "cut" };

/** The cutting refusals per row: a save remembers the count when it is queued and is cut when it grew meanwhile. */
export class SaveCuts {
  private refused = new Map<string, number>();

  /** Taken when a save is queued. */
  mark(id: string): number {
    return this.refused.get(id) ?? 0;
  }

  /** Whether a cutting refusal of the row was answered since `mark`. */
  cutSince(id: string, mark: number): boolean {
    return (this.refused.get(id) ?? 0) > mark;
  }

  /** A save of the row was refused with `code`. */
  refuse(id: string, code: string | undefined): void {
    if (code && CUTTING_REFUSALS.has(code)) this.refused.set(id, (this.refused.get(id) ?? 0) + 1);
  }
}

/**
 * Answers waiting for the next fresh page: `wait` holds an answer until `merged` is called (the fresh page's rows have
 * been merged) or `FRESH_WAIT_MS` passed; `pages` counts the merges, so a refusal whose page came first is not held.
 */
export class FreshWaits {
  private waiting: (() => void)[] = [];
  pages = 0;

  /** Runs `answer` after the next merge, or at once when a page was merged since `since` (a `pages` count). */
  wait(since: number, answer: () => void, timeout: (run: () => void, ms: number) => void = (run, ms) => void setTimeout(run, ms)): void {
    if (this.pages > since) {
      answer();
      return;
    }
    let done = false;
    const once = () => {
      if (done) return;
      done = true;
      answer();
    };
    this.waiting.push(once);
    timeout(once, FRESH_WAIT_MS);
  }

  /** A fresh page's rows have been merged: every waiting answer runs. */
  merged(): void {
    this.pages++;
    const w = this.waiting;
    this.waiting = [];
    for (const answer of w) answer();
  }
}
