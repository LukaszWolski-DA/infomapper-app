"use client";

// Step 3 of the import wizard, Review changes (slice 7a, PRD items 24–27; prototype `stepReview`): filters with counts,
// a card per table with a row per column (what changes and what it touches), the rename choices, the relationships
// between source tables, the warnings, the mappings that go back to review (P6), and P8's refresh. Everything here is
// what the import will write; nothing is written before “Import into”. A long review renders in parts (“Show the next
// … tables”, “Show … more columns”) so a large file keeps the dialog responsive. Slice 7b (item 9; prototype `reqBox`,
// `issBox`): above the tables, the requirements whose coverage changes and the changes to resolve the import raises,
// both over the whole plan.
// Slice 7c (items 19, 20): a new column's classifications as chips, a Data Vault one marked (and, with the mode off,
// "hidden while Data Vault 2.0 mode is off"); "The file says …; your classifications are kept."; the "Suggested
// classifications", ticked by default, the unticked ones sent with the choices.

import { useState } from "react";
import { formatColumnType } from "@/domain/model/type-check";
import type { ClassificationHint, ImportPlan, PlanColumn, PlanTable } from "@/domain/import/plan";
import { isDataVault } from "@/domain/model/classifications";
import type { Classification } from "@/domain/types";
import { coverageChangeText, type CoverageDelta } from "@/domain/source-changes/coverage";
import { NO_COVERAGE_CHANGE, raisedCallout } from "@/domain/source-changes/texts";
import { day, impactOf, nothingText, plural, reviewCounts, shownUnder, type impactIndex, type ImportData, type ReviewFilter, type WizardState } from "./wizard-model";

const PAGE_TABLES = 100;
const PAGE_ROWS = 50;
const PAGE_RELATIONSHIPS = 200;

const TAG: Record<string, string> = {
  new: "bg-im-map-soft text-im-map",
  changed: "bg-im-logical-soft text-im-logical",
  rename: "bg-im-logical-soft text-im-logical",
  back: "bg-im-logical-soft text-im-logical",
  missing: "bg-im-warn-soft text-im-warn",
  still_missing: "bg-im-warn-soft text-im-warn",
  unchanged: "bg-im-hover text-im-ink-3",
};
const WORD: Record<string, string> = { new: "new", changed: "changed", missing: "missing", rename: "renamed", back: "back", unchanged: "same", still_missing: "missing" };

const Tag = ({ status, children }: { status: string; children?: string }) => (
  <span className={`inline-flex h-[18px] items-center whitespace-nowrap rounded px-1.5 text-[11px] font-medium ${TAG[status] ?? TAG.unchanged}`}>{children ?? WORD[status] ?? status}</span>
);
const Arrow = () => <span className="mx-1 text-im-ink-3">→</span>;
const Key = ({ children }: { children: string }) => <span className="rounded-[3px] bg-im-physical-soft px-1 font-mono text-[10px] text-im-physical">{children}</span>;
const rowClass = "grid grid-cols-[86px_minmax(130px,1fr)] gap-x-3 gap-y-1 border-t border-im-line px-3 py-[7px] md:grid-cols-[86px_minmax(130px,1fr)_minmax(160px,1.3fr)_minmax(180px,1.6fr)]";
const callout = "my-3 rounded-r-md border-l-[3px] px-3 py-2";
const chip = "mr-1 inline-block rounded-[10px] bg-im-physical-soft px-1.5 text-[11.5px] text-im-physical";

/** A classification as a chip (prototype `classChips`); a Data Vault one marked, and hidden with the mode off (P5). */
function ClassChip({ c, dataVault }: { c: Classification | undefined; dataVault: boolean }) {
  if (!c) return null;
  return (
    <span className="mr-1 inline-flex flex-wrap items-center gap-1" data-testid="review-classification">
      <span className={chip}>{c.name}</span>
      {isDataVault(c) && (
        <>
          <span className={`${chip} opacity-80`} data-testid="chip-data-vault">
            Data Vault 2.0
          </span>
          {!dataVault && <span className="text-[11.5px] text-im-ink-3">hidden while Data Vault 2.0 mode is off</span>}
        </>
      )}
    </span>
  );
}

export function ReviewStep({
  s,
  set,
  plan,
  data,
  index,
  systemName,
  coverage,
}: {
  s: WizardState;
  set: (patch: Partial<WizardState>) => void;
  plan: ImportPlan;
  data: ImportData;
  index: ReturnType<typeof impactIndex>;
  systemName: string;
  /** Requirements whose coverage the import changes (slice 7b). */
  coverage: readonly CoverageDelta[];
}) {
  const [showUnchanged, setShowUnchanged] = useState<ReadonlySet<string>>(new Set());
  const [tablesShown, setTablesShown] = useState(PAGE_TABLES);
  const [rowsShown, setRowsShown] = useState<ReadonlyMap<string, number>>(new Map());
  const [relationshipsShown, setRelationshipsShown] = useState(PAGE_RELATIONSHIPS);
  const n = reviewCounts(plan);
  const F = s.filter;
  const sendBacks = plan.mappings.filter((m) => m.sendsBack);
  const raised = raisedCallout(plan.raises, systemName);
  const raisedHigh = plan.raises.some((r) => r.severity === "high");
  const requirementName = new Map(data.requirements.map((r) => [r.id, r.name]));
  const classificationById = new Map(data.model.classifications.map((c) => [c.id, c]));
  const hints = plan.hints;
  const tick = (h: ClassificationHint, on: boolean) => {
    const off = new Set(s.hintsOff);
    if (on) off.delete(h.id);
    else off.add(h.id);
    set({ hintsOff: off });
  };

  const filters: [ReviewFilter, string, number][] = [
    ["all", "all changes", n.all],
    ["new", n.tablesNew ? `new (${plural(n.tablesNew, "table")})` : "new columns", n.new],
    ["changed", "changed", n.changed],
    ["rename", "removed or renamed?", n.rename],
    ["missing", "missing from source", n.missing],
    ["rel", "relationships", n.rel],
  ];

  const what = (c: PlanColumn) => {
    if (c.status === "new" && c.file) {
      const f = c.file;
      return (
        <>
          <span className="font-mono">{formatColumnType(f)}</span> {f.is_primary_key && <Key>PK</Key>} {f.is_foreign_key && <Key>FK</Key>} {!f.is_nullable && <span className="text-im-ink-3">not null</span>}{" "}
          {/* slice 7c: the classifications the file's values matched */}
          {c.classificationIds.map((id) => (
            <ClassChip key={id} c={classificationById.get(id)} dataVault={data.dataVault} />
          ))}
        </>
      );
    }
    if (c.status === "missing" || c.status === "still_missing") return <span className="text-im-ink-3">Was {formatColumnType(c.existing!)}</span>;
    const lines = [
      ...(c.status === "back" ? [<span key="back">Back in the source after being missing since {day(c.existing?.missing_since)}</span>] : []),
      // a rename's name change is in the name column already
      ...c.changes.filter((x) => !(c.status === "rename" && x.field === "name")).map((x) => (
        <span key={x.field}>
          {x.field}: <span className="font-mono">{x.before}</span>
          <Arrow />
          <span className="font-mono">{x.after}</span>
        </span>
      )),
      ...(c.position
        ? [
            <span key="position" className="text-im-ink-3">
              position {c.position.before}
              <Arrow />
              {c.position.after}
            </span>,
          ]
        : []),
    ];
    if (c.status === "rename" && !c.changes.some((x) => x.field !== "name")) lines.push(<span key="same" className="text-im-ink-3">Same type and position</span>);
    return (
      <>
        {lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
        {c.fileClassifications && (
          <div className="text-xs text-im-ink-3" data-testid="review-file-says">
            The file says {c.fileClassifications.join(", ")}; your classifications are kept.
          </div>
        )}
      </>
    );
  };

  const impact = (c: PlanColumn) => {
    const lines = impactOf(c, plan, index);
    if (!lines.length) return c.status === "missing" ? <span className="text-im-ink-3">Not mapped</span> : null;
    const canvases = c.existing ? (data.canvasesOf[c.existing.source_table_id] ?? []).map((id) => data.canvasNames[id]).filter(Boolean) : [];
    return (
      <>
        {lines.map((l, i) => (
          <div key={i} data-testid="review-impact">
            Feeds <b>{l.label}</b> ({l.status})
            {l.notes.map((x, j) => (
              <span key={j} className={x.warn ? "text-im-warn" : undefined}>
                ; {x.text}
                {x.code && <span className="font-mono">{x.code}</span>}
              </span>
            ))}
            {l.requirementKeys.length > 0 && (
              <>
                ;{" "}
                {l.requirementKeys.map((k) => (
                  <span key={k} className="mr-1 rounded bg-im-req-soft px-1.5 text-[11px] font-medium text-im-req-ink" data-testid="review-requirement">
                    {k}
                  </span>
                ))}
              </>
            )}
          </div>
        ))}
        {canvases.length > 0 && <div className="text-im-ink-3">On {canvases.join(", ")}</div>}
      </>
    );
  };

  const decide = (c: PlanColumn) => {
    const r = c.renameKey ? plan.renames.find((x) => x.key === c.renameKey) : null;
    if (!r || (c.status !== "rename" && c.status !== "missing")) return null;
    return (
      <div className="col-span-full flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md bg-im-logical-soft px-2.5 py-1.5 md:col-start-2">
        <label className="flex items-center gap-1.5">
          What happened to <b className="font-mono">{r.from}</b>?
          <select
            value={r.choice}
            onChange={(e) => set({ renames: new Map(s.renames).set(r.key, e.target.value) })}
            className="rounded-md border border-im-line bg-im-surface px-2 py-1"
            data-testid="select-rename"
            data-key={r.key}
          >
            <option value="">It was removed from the source</option>
            {r.options.map((o) => (
              <option key={o} value={o}>
                It was renamed to {o}
                {o === r.suggested ? " (suggested: same position and type)" : ""}
              </option>
            ))}
          </select>
        </label>
        <span className="text-im-ink-3">A rename keeps its mappings, classifications and notes.</span>
      </div>
    );
  };

  const row = (t: PlanTable, c: PlanColumn) => {
    const name = c.file?.name ?? c.existing!.name;
    return (
      <div key={`${c.existing?.id ?? ""}|${name}`} className={rowClass} data-testid="review-row" data-column={name} data-status={c.status}>
        <span>
          <Tag status={c.status} />
        </span>
        <span className="font-mono">
          {c.status === "rename" ? (
            <>
              {c.existing!.name}
              <Arrow />
              {name}
            </>
          ) : (
            name
          )}
        </span>
        <span className="text-im-ink-2 max-md:col-start-2">{what(c)}</span>
        <span className="text-xs text-im-ink-2 max-md:col-start-2">{impact(c)}</span>
        {decide(c)}
      </div>
    );
  };

  const cards = plan.tables.filter((t) => t.status !== "still_missing");
  const visibleCards = cards
    .map((t) => {
      const rows = t.columns.filter((c) => shownUnder(F, c));
      const meta = (F === "all" || F === "changed") && t.meta.length > 0;
      const show = rows.length > 0 || meta || (F === "all" && t.status === "missing");
      return show ? { t, rows, meta } : null;
    })
    .filter((x): x is { t: PlanTable; rows: PlanColumn[]; meta: boolean } => !!x);
  const nothing = n.all === 0;
  const rels = plan.relationships.filter((r) => r.status !== "unchanged" && r.status !== "still_missing");

  return (
    <div>
      {s.stale && (
        <div className={`${callout} border-im-warn bg-im-warn-soft`} data-testid="callout-stale">
          {s.stale}
        </div>
      )}
      <div className="mb-3.5 flex flex-wrap gap-1.5" role="group" aria-label="Show">
        {filters.map(([k, label, v]) => (
          <button
            key={k}
            type="button"
            aria-pressed={F === k}
            onClick={() => set({ filter: k })}
            className={`inline-flex h-[30px] items-center gap-1.5 rounded-[15px] border px-2.5 ${F === k ? "border-im-logical bg-im-logical-soft text-im-logical" : "border-im-line bg-im-surface text-im-ink-2"}`}
            data-testid={`filter-${k}`}
          >
            <b className={F === k ? "text-im-logical" : "text-im-ink"}>{v.toLocaleString("en-GB")}</b> {label}
          </button>
        ))}
      </div>
      {coverage.length > 0 ? (
        <div className="mb-4 rounded-lg border border-im-req bg-im-surface px-3 py-2.5" data-testid="callout-coverage">
          <h4 className="mb-1.5 font-semibold text-im-req-ink">Requirements whose coverage changes</h4>
          <ul>
            {coverage.map((d) => (
              <li key={d.requirement.id} className="flex flex-wrap items-baseline gap-x-2.5 py-1" data-testid="coverage-change">
                <span className="rounded bg-im-req-soft px-1.5 text-[11px] font-medium text-im-req-ink">{d.requirement.key}</span>
                <span>{requirementName.get(d.requirement.id) ?? d.requirement.name}</span>
                <span className="font-mono">{coverageChangeText(d)}</span>
                {d.why.length > 0 && <span className="text-xs text-im-ink-2">{d.why.join("; ")}</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        s.mode === "existing" && (
          <div className={`${callout} border-im-logical bg-im-logical-soft`} data-testid="callout-coverage">
            {NO_COVERAGE_CHANGE}
          </div>
        )
      )}
      {raised && (
        <div className={`${callout} ${raisedHigh ? "border-im-warn bg-im-warn-soft" : "border-im-logical bg-im-logical-soft"}`} data-testid="callout-changes" data-high={raisedHigh || undefined}>
          {raised}
        </div>
      )}
      {sendBacks.length > 0 && (
        <div className={`${callout} border-im-warn bg-im-warn-soft`} data-testid="callout-send-back">
          <b>
            {plural(sendBacks.length, "approved mapping")} {sendBacks.length === 1 ? "goes" : "go"} back to review after this import
          </b>
          <ul className="mt-1 list-disc pl-[18px]">
            {sendBacks.map((m) => (
              <li key={m.mappingId}>
                {m.label}: {m.reasons.join("; ")}
              </li>
            ))}
          </ul>
        </div>
      )}
      {nothing && (
        <div className={`${callout} border-im-logical bg-im-logical-soft`} data-testid="review-nothing">
          {nothingText(systemName, plan.tables.some((t) => t.columns.some((c) => !!c.fileClassifications)))}
        </div>
      )}
      {visibleCards.slice(0, tablesShown).map(({ t, rows, meta }) => {
        const name = t.file ? `${t.file.schema}.${t.file.name}` : `${t.existing!.schema_name}.${t.existing!.name}`;
        const unchanged = t.columns.filter((c) => c.status === "unchanged" && !rows.includes(c));
        const open = showUnchanged.has(t.key);
        const limit = rowsShown.get(t.key) ?? PAGE_ROWS;
        // an unchanged table shows only for "The file says …" rows, which are no change (slice 7c, answers to step 5)
        const header = t.status === "new" ? "new table" : t.status === "missing" ? "missing table" : t.status === "back" ? "back" : t.status === "unchanged" ? "same" : "changed";
        return (
          <section key={t.key} className="mb-2.5 overflow-hidden rounded-lg border border-im-line" data-testid="review-table" data-key={t.key} data-status={t.status}>
            <header className="flex flex-wrap items-center gap-2 bg-im-panel px-3 py-2">
              <Tag status={t.status}>{header}</Tag>
              <span className="font-mono font-semibold">{name}</span>
              {t.file?.objectType === "file" && <span className="rounded-[10px] bg-im-hover px-1.5 text-[11.5px] text-im-ink-2">{t.file.fileFormat ?? ""} file</span>}
              {t.file?.comment && t.status === "new" && <span className="text-im-ink-3">{t.file.comment}</span>}
              <span className="ml-auto text-xs text-im-ink-3">
                {t.status === "new" ? plural(t.columns.length, "column") : t.rows ? `rows ${t.rows.before?.toLocaleString("en-GB") ?? "–"} → ${t.rows.after.toLocaleString("en-GB")}` : ""}
              </span>
            </header>
            {meta &&
              t.meta.map((m) => (
                <div key={m.field} className={rowClass} data-testid="review-meta">
                  <span>
                    <Tag status="changed">table</Tag>
                  </span>
                  <span>{m.field}</span>
                  <span className="text-im-ink-2 max-md:col-start-2">
                    <span className="font-mono">{m.before}</span>
                    <Arrow />
                    <span className="font-mono">{m.after}</span>
                  </span>
                  <span />
                </div>
              ))}
            {rows.slice(0, limit).map((c) => row(t, c))}
            {rows.length > limit && (
              <div className="border-t border-im-line px-3 py-1.5">
                <button type="button" className="text-im-logical underline" onClick={() => setRowsShown(new Map(rowsShown).set(t.key, limit + PAGE_ROWS * 10))} data-testid="button-more-rows">
                  Show {plural(Math.min(rows.length - limit, PAGE_ROWS * 10), "more column")}
                </button>
              </div>
            )}
            {unchanged.length > 0 && F === "all" && (
              <>
                <div className="border-t border-im-line px-3 py-1.5">
                  <button
                    type="button"
                    className="text-im-logical underline"
                    onClick={() => {
                      const next = new Set(showUnchanged);
                      if (open) next.delete(t.key);
                      else next.add(t.key);
                      setShowUnchanged(next);
                    }}
                    data-testid="button-unchanged"
                  >
                    {open ? "Hide" : "Show"} {plural(unchanged.length, "unchanged column")}
                  </button>
                </div>
                {open &&
                  unchanged.map((c) => (
                    <div key={c.existing!.id} className={rowClass} data-testid="review-row" data-column={c.existing!.name} data-status="unchanged">
                      <span>
                        <Tag status="unchanged" />
                      </span>
                      <span className="font-mono">{c.existing!.name}</span>
                      <span className="font-mono text-im-ink-2 max-md:col-start-2">
                        {formatColumnType(c.existing!)}
                        {c.position && (
                          <span className="ml-2 font-sans text-im-ink-3">
                            position {c.position.before}
                            <Arrow />
                            {c.position.after}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-im-ink-2 max-md:col-start-2">
                        {impactOf(c, plan, index).map((l) => (
                          <div key={l.label}>→ {l.label}</div>
                        ))}
                      </span>
                    </div>
                  ))}
              </>
            )}
          </section>
        );
      })}
      {visibleCards.length > tablesShown && (
        <p className="mb-3">
          <button type="button" className="text-im-logical underline" onClick={() => setTablesShown(tablesShown + PAGE_TABLES)} data-testid="button-more-tables">
            Show the next {plural(Math.min(PAGE_TABLES, visibleCards.length - tablesShown), "table")} of {visibleCards.length.toLocaleString("en-GB")}
          </button>
        </p>
      )}
      {!visibleCards.length && !nothing && F !== "rel" && <p className="text-im-ink-3">Nothing of this kind.</p>}
      {(F === "all" || F === "rel") && rels.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-[13px] font-semibold">Relationships between source tables</h3>
          <div className="overflow-hidden rounded-lg border border-im-line">
            {rels.slice(0, relationshipsShown).map((r) => (
              <div key={`${r.fromKey}|${r.name}`} className={`${rowClass} first:border-t-0`} data-testid="review-relationship" data-status={r.status}>
                <span>
                  <Tag status={r.status} />
                </span>
                <span className="font-mono">
                  {r.renamedFrom ? (
                    <>
                      {r.renamedFrom}
                      <Arrow />
                      {r.name}
                    </>
                  ) : (
                    r.name
                  )}
                </span>
                <span className="font-mono text-im-ink-2 max-md:col-start-2">
                  {r.fromLabel}
                  {r.pairs.length ? `.${r.pairs.map((p) => p.from).join(", ")}` : ""}
                  <Arrow />
                  {r.toLabel}
                  {r.pairs.length ? `.${r.pairs.map((p) => p.to).join(", ")}` : ""}
                </span>
                <span className="text-xs text-im-ink-2 max-md:col-start-2">{r.status === "missing" ? "No longer declared in the source" : ""}</span>
              </div>
            ))}
          </div>
          {rels.length > relationshipsShown && (
            <p className="mt-2">
              <button type="button" className="text-im-logical underline" onClick={() => setRelationshipsShown(relationshipsShown + PAGE_RELATIONSHIPS)} data-testid="button-more-relationships">
                Show the next {plural(Math.min(PAGE_RELATIONSHIPS, rels.length - relationshipsShown), "relationship")} of {rels.length.toLocaleString("en-GB")}
              </button>
            </p>
          )}
        </>
      )}
      {F === "rel" && !rels.length && <p className="text-im-ink-3">Nothing of this kind.</p>}
      {(F === "all" || F === "new") && hints.length > 0 && (
        <>
          <h3 className="mb-1 mt-5 text-[13px] font-semibold">Suggested classifications</h3>
          <p className="mb-2 text-xs text-im-ink-3">Suggestions only. Untick what does not fit; you can change classifications on the column later.</p>
          <div className="flex flex-col gap-1" data-testid="review-suggestions">
            {hints.map((h) => (
              <label key={h.id} className="flex flex-wrap items-center gap-2" data-testid="review-suggestion" data-hint={h.id}>
                <input type="checkbox" checked={h.on} onChange={(e) => tick(h, e.currentTarget.checked)} data-testid="checkbox-suggestion" />
                <span className="font-mono text-xs">{h.label}</span>
                <ClassChip c={classificationById.get(h.classificationId)} dataVault={data.dataVault} />
                <span className="text-xs text-im-ink-3">{h.why}</span>
              </label>
            ))}
          </div>
        </>
      )}
      {F === "all" && plan.warnings.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-[13px] font-semibold">Warnings</h3>
          <div className={`${callout} mt-0 border-im-warn bg-im-warn-soft`} data-testid="review-warnings">
            <ul className="list-disc pl-[18px]">
              {plan.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
