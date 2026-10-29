// The panels' saves, one row at a time (slice 9, items 1–3, F2–F5). A panel saves a row with the version it shows; a
// second save of the same row started before the first one's answer used to send that same version and was refused as
// a conflict. Here each row's saves run one after the other, and each one reads the version when it is sent: the larger
// of the version its field showed and the one the row's last answered save (or an undo) returned. Versions only grow
// (an undo writes a new one), so the larger is never too new. The order is ours, not only Next.js's queue of actions,
// which it calls an implementation detail.
//
// A save refused for a stale version, a permission or the archive cuts the row's saves already waiting behind it: they
// are not sent (one toast, the first refusal's). A validation refusal cuts nothing. Undo and redo run `exclusive`: after
// every save on its way, and before any save started meanwhile.

/** What a save's answer needs to say: whether it was stored, why not, and the row's new version. */
export interface SaveOutcome {
  ok: boolean;
  code?: string;
  value?: unknown;
}

/** Refusals after which the saves waiting behind cannot succeed either. */
const CUTS = new Set(["stale_version", "forbidden", "archived"]);

interface Row {
  /** The newest version an answer gave. */
  answered: number;
  /** The row's last save, settled. */
  tail: Promise<void>;
  /** Saves started so far. */
  started: number;
  /** Saves up to this number are not sent (cut by a refusal). */
  cutThrough: number;
}

const versionOf = (value: unknown): number | null => {
  const v = (value as { version?: unknown } | null | undefined)?.version;
  return typeof v === "number" ? v : null;
};

const quiet = (p: Promise<unknown>): Promise<void> => p.then(
  () => undefined,
  () => undefined,
);

export class RowSaves {
  private rows = new Map<string, Row>();
  /** The undo or redo on its way, settled. */
  private gate: Promise<void> = Promise.resolve();

  private row(id: string): Row {
    let row = this.rows.get(id);
    if (!row) this.rows.set(id, (row = { answered: 0, tail: Promise.resolve(), started: 0, cutThrough: 0 }));
    return row;
  }

  /**
   * Sends a save of row `id` after its earlier saves and any undo on its way, with the newest version known then
   * (`shown`: the version the field showed). Resolves with the answer, or `null` when a refusal before it cut it.
   */
  save<R extends SaveOutcome>(id: string, shown: number, send: (version: number) => Promise<R>): Promise<R | null> {
    const row = this.row(id);
    const n = ++row.started;
    const result = Promise.all([row.tail, this.gate]).then(async (): Promise<R | null> => {
      if (n <= row.cutThrough) return null;
      const outcome = await send(Math.max(row.answered, shown));
      if (outcome.ok) {
        const v = versionOf(outcome.value);
        if (v !== null) row.answered = Math.max(row.answered, v);
      } else if (outcome.code && CUTS.has(outcome.code)) row.cutThrough = row.started;
      return outcome;
    });
    row.tail = quiet(result);
    return result;
  }

  /** Versions written elsewhere (an undo or a redo): the rows' next saves send them. */
  answer(versions: Readonly<Record<string, number>>): void {
    for (const [id, v] of Object.entries(versions)) {
      const row = this.row(id);
      row.answered = Math.max(row.answered, v);
    }
  }

  /** Every save started so far, and the undo on its way, settled. */
  settled(): Promise<void> {
    return quiet(Promise.all([...[...this.rows.values()].map((r) => r.tail), this.gate]));
  }

  /** Runs `step` after every save started so far; saves started meanwhile wait for it (undo and redo, F5). */
  exclusive<T>(step: () => Promise<T>): Promise<T> {
    const run = this.settled().then(step);
    this.gate = quiet(run);
    return run;
  }
}

/** The page's saves (one per browser tab). */
export const rowSaves = new RowSaves();
