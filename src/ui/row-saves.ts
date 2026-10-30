// The panels' saves, one row at a time (slice 9, items 1–3, F2–F5). A panel saves a row with the version it shows; a
// second save of the same row started before the first one's answer used to send that same version and was refused as
// a conflict. Here each row's saves run one after the other, and each one reads the version when it is sent: the larger
// of the version its field showed and the one the row's last answered save (or an undo) returned. Versions only grow
// (an undo writes a new one), so the larger is never too new. The order is ours, not only Next.js's queue of actions,
// which it calls an implementation detail.
//
// A save refused for a stale version, a permission, the archive or a row not found cuts the row's saves already waiting
// behind it: they are not sent (one toast, the first refusal's). A validation refusal cuts nothing. Undo and redo run
// `exclusive`: after every save on its way, and before any save started meanwhile.
//
// Slice 10a (F3): a write over several rows (moving an attribute renumbers its siblings, a merge, a concept deleted with
// its entities moved) runs through `saveRows`: after every listed row's saves, holding all of them until its answer, and
// feeding back every version the answer gives. `save` is its one-row case.

/**
 * What a save's answer needs to say: whether it was stored, why not, and the row's new version (`value.version`), or
 * the new version of every row it wrote (`versions`, slice 10a).
 */
export interface SaveOutcome {
  ok: boolean;
  code?: string;
  value?: unknown;
  versions?: Readonly<Record<string, number>>;
}

/** Refusals after which the saves waiting behind cannot succeed either (a row not found stays so: slice 10a, F5). */
const CUTS = new Set(["stale_version", "forbidden", "archived", "not_found"]);

/**
 * A row a several-row save writes: with `shown` (the version the page shows) when its version is sent and checked,
 * without when the save only rewrites it (a renumbered sibling, a moved entity).
 */
export interface SaveRowsRow {
  id: string;
  shown?: number;
}

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
  save<R extends SaveOutcome>(id: string, shown: number, send: (version: number) => Promise<R>, options: { deletes?: boolean } = {}): Promise<R | null> {
    return this.saveRows([{ id, shown }], (versionOf) => send(versionOf(id)), options);
  }

  /**
   * Sends a save that writes several rows (slice 10a, F3): after the earlier saves of every row it lists and any undo on
   * its way; saves of those rows started meanwhile wait for it. `send` gets the newest known version of each checked row.
   * It is not sent when a refusal before it cut one of its checked rows (a held row's version is not sent, so its cut
   * does not stop it). On success the answer's `versions` reach every row, and its `value.version` the first checked
   * row; a cutting refusal cuts the waiting saves of every row it lists. With `deletes` (the write deletes its checked
   * rows), a success cuts the checked rows' saves waiting behind it too: they would be refused as not found (F5).
   */
  saveRows<R extends SaveOutcome>(
    rows: readonly SaveRowsRow[],
    send: (versionOf: (id: string) => number) => Promise<R>,
    options: { deletes?: boolean } = {},
  ): Promise<R | null> {
    const listed = new Map<string, SaveRowsRow>();
    for (const r of rows) if (!listed.get(r.id)?.shown) listed.set(r.id, r);
    const parts = [...listed.values()].map((r) => {
      const row = this.row(r.id);
      return { ...r, row, n: ++row.started };
    });
    const checked = parts.filter((p) => p.shown !== undefined);
    const result = Promise.all([...parts.map((p) => p.row.tail), this.gate]).then(async (): Promise<R | null> => {
      if (checked.some((p) => p.n <= p.row.cutThrough)) return null;
      const outcome = await send((id) => {
        const p = checked.find((x) => x.id === id);
        if (!p) throw new Error(`saveRows: ${id} is not a checked row of this save`);
        return Math.max(p.row.answered, p.shown!);
      });
      if (outcome.ok) {
        if (outcome.versions) this.answer(outcome.versions);
        const v = versionOf(outcome.value);
        const first = checked[0];
        if (v !== null && first) first.row.answered = Math.max(first.row.answered, v);
        if (options.deletes) for (const p of checked) p.row.cutThrough = p.row.started;
      } else if (outcome.code && CUTS.has(outcome.code)) for (const p of parts) p.row.cutThrough = p.row.started;
      return outcome;
    });
    for (const p of parts) p.row.tail = quiet(result);
    return result;
  }

  /**
   * Versions written elsewhere (an undo or a redo; a write whose rows only the server knows, slice 10a): the rows' next
   * saves send them.
   */
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
