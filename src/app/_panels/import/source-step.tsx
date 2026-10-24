"use client";

// Step 1 of the import wizard, Source (slice 7a, PRD items 14–19, 21; prototype `stepSource`, `ddlIn`): into which
// system, where the description comes from (a file, a query on the database, DDL scripts; dbt shown disabled), and
// InfoMapper's source standard with `template.csv`. No sample links (P10). Files are read in the browser; nothing is
// sent until “Import into”.

import { useState, type ReactNode } from "react";
import { ddlSummaryText, skippedText } from "@/domain/import/ddl";
import { STANDARD_TEMPLATE } from "@/domain/import/standard";
import type { WorkspaceModel } from "@/domain/types";
import { inputClass, smallButtonClass } from "../fields";
import { VENDORS, type Vendor } from "./catalog-queries";
import { day, plural, type Channel, type WizardState } from "./wizard-model";

/** InfoMapper's source standard v1 (prototype `STD_INFO`). */
const STANDARD_INFO: [column: string, required: string, what: string][] = [
  ["database", "yes", "Database name, e.g. crmprod"],
  ["schema", "yes", "Schema name, e.g. dbo"],
  ["table", "yes", "Table or view name"],
  ["object_type", "", "table, view or file (default table)"],
  ["file_format", "", "For a file: xlsx, csv, txt, json, xml, parquet… as you call it"],
  ["row_count", "", "Number of rows"],
  ["table_comment", "", "Comment from the source"],
  ["column", "yes", "Column name"],
  ["ordinal", "", "Physical position (default: file order)"],
  ["data_type", "yes", "As in the source; varchar(20) or varchar with length 20"],
  ["length, precision, scale", "", "When not in data_type"],
  ["nullable", "", "yes / no (default yes)"],
  ["primary_key", "", "yes / no"],
  ["fk_name, fk_ref_schema, fk_ref_table, fk_ref_column", "", "A foreign key: one row per column of the key"],
  ["column_comment", "", "Comment from the source"],
  ["classifications", "", "Codes or names separated by ;  e.g. BK;PII"],
];

const CHANNELS: [Channel | "dbt", string, string][] = [
  ["file", "A file", "CSV in InfoMapper’s standard"],
  ["query", "A query on the database", "We give the query; you run it"],
  ["ddl", "DDL scripts", "CREATE TABLE scripts, translated to the standard"],
  ["dbt", "dbt project", "catalog.json, later"],
];

const codeClass = "min-h-[140px] w-full resize-y overflow-auto whitespace-pre rounded-md border border-im-line bg-im-surface px-2 py-1.5 font-mono text-xs leading-normal";
const sectionClass = "mb-5";
const headClass = "mb-2 text-[13px] font-semibold";
const hintClass = "mt-1 text-xs text-im-ink-3";

function CopyButton({ text, testId, label = "Copy" }: { text: string; testId: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={smallButtonClass}
      data-testid={testId}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(
          () => setCopied(true),
          () => setCopied(false),
        );
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function CodeBox({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-md border border-im-line">
      <div className="flex flex-wrap items-center gap-2 border-b border-im-line bg-im-panel px-2.5 py-1.5 text-xs">{head}</div>
      <div className="p-1.5">{children}</div>
    </div>
  );
}

/** A drop zone with its hidden file input (prototype `.drop`). */
function Drop({ onFile, accept, slim, testId, children }: { onFile: (file: File) => void; accept: string; slim?: boolean; testId: string; children: ReactNode }) {
  const [over, setOver] = useState(false);
  return (
    <label
      className={`mt-2 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed p-4 text-center text-im-ink-2 ${slim ? "min-h-[56px]" : "min-h-[120px]"} ${over ? "border-im-logical bg-im-logical-soft" : "border-im-line"}`}
      data-testid={`drop-${testId}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      {children}
      <input
        type="file"
        accept={accept}
        className="sr-only"
        data-testid={`input-${testId}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </label>
  );
}

/** What was read: name and counts, or the reader's error (item 14). */
function ReadState({ s, onClear }: { s: WizardState; onClear: () => void }) {
  const r = s.read!;
  if (r.errors.length) {
    return (
      <div className="my-2.5 rounded-lg bg-im-warn-soft px-3 py-2.5" data-testid="import-error">
        <b className="text-im-warn">The file can’t be read.</b> {r.errors.join(" ")}{" "}
        <button type="button" className="text-im-logical underline" onClick={onClear} data-testid="button-choose-another">
          Choose another
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-lg bg-im-map-soft px-3 py-2.5" data-testid="import-loaded">
      <span className="min-w-0 flex-1">
        <b className="mr-2" title={r.fileName}>
          {r.fileName}
        </b>
        <span>
          {plural(r.tables.length, "table")}, {plural(r.columnCount, "column")}
          {r.warnings.length ? `, ${plural(r.warnings.length, "warning")} (shown in the review)` : ""}
        </span>
      </span>
      <button type="button" className={smallButtonClass} onClick={onClear} data-testid="button-choose-another">
        Choose another
      </button>
    </div>
  );
}

export function SourceStep({
  s,
  set,
  model,
  lastImports,
  takeText,
  readScript,
  clear,
}: {
  s: WizardState;
  set: (patch: Partial<WizardState>) => void;
  model: WorkspaceModel;
  lastImports: Readonly<Record<string, string>>;
  /** Reads a file's or a paste's text as the standard. */
  takeText: (text: string, label: string) => void;
  /** Translates and reads the DDL script in `s.ddl`. */
  readScript: (ddl: WizardState["ddl"]) => void;
  clear: () => void;
}) {
  const [filter, setFilter] = useState("");
  const [paste, setPaste] = useState("");
  const systems = [...model.sourceSystems].sort((a, b) => a.name.localeCompare(b.name));
  const tablesOf = (id: string) => model.sourceTables.filter((t) => t.source_system_id === id).length;
  const fromFile = (file: File) => void file.text().then((text) => takeText(text, file.name));

  const target = (
    <section className={sectionClass}>
      <h3 className={headClass}>Into which system?</h3>
      <div className="mb-2.5 inline-flex rounded-md border border-im-line p-0.5" role="radiogroup" aria-label="Target">
        {(["existing", "new"] as const).map((m) => (
          <label key={m} className={`cursor-pointer rounded px-3 py-1 ${s.mode === m ? "bg-im-logical-soft text-im-logical" : "text-im-ink-2"}`}>
            <input type="radio" name="import-target" className="sr-only" checked={s.mode === m} onChange={() => set({ mode: m, systemId: s.systemId ?? systems[0]?.id ?? null })} data-testid={`radio-target-${m}`} />
            {m === "existing" ? "An existing system" : "A new system"}
          </label>
        ))}
      </div>
      {s.mode === "existing" ? (
        <div className="max-w-[560px]">
          {systems.length > 5 && (
            <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a system" aria-label="Find a system" className={`${inputClass} mb-1.5`} data-testid="input-find-system" />
          )}
          <div className="max-h-[220px] overflow-auto rounded-md border border-im-line" role="radiogroup" aria-label="Source system">
            {!systems.length && <p className="px-3 py-2 text-im-ink-3">No systems yet. Choose “A new system”.</p>}
            {systems
              .filter((x) => !filter.trim() || x.name.toLowerCase().includes(filter.trim().toLowerCase()))
              .map((x) => (
                <label key={x.id} className="flex cursor-pointer items-center gap-2 border-b border-im-line px-3 py-1.5 last:border-b-0 hover:bg-im-hover" data-testid="system-choice">
                  <input type="radio" name="import-system" value={x.id} checked={s.systemId === x.id} onChange={() => set({ systemId: x.id })} data-testid="radio-system" />
                  <span className="min-w-0 flex-1 truncate font-medium" title={x.name}>
                    {x.name}
                  </span>
                  <span className="text-xs text-im-ink-3">
                    {plural(tablesOf(x.id), "table")} · {lastImports[x.id] ? `last import ${day(lastImports[x.id])}` : "not imported yet"}
                  </span>
                </label>
              ))}
          </div>
        </div>
      ) : (
        <label className="block max-w-[560px]">
          <span className="mb-1 block text-[11.5px] text-im-ink-3">Name of the new system</span>
          <input type="text" value={s.newName} onChange={(e) => set({ newName: e.target.value })} placeholder="e.g. HR or Salesforce EMEA production" className={inputClass} data-testid="input-new-system-name" autoFocus />
          <span className={hintClass}>Everything in the file will be new.</span>
        </label>
      )}
    </section>
  );

  const channels = (
    <section className={sectionClass}>
      <h3 className={headClass}>Where does the description come from?</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2" role="radiogroup" aria-label="Channel">
        {CHANNELS.map(([k, title, what]) => {
          const off = k === "dbt";
          const on = s.channel === k;
          return (
            <label key={k} className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${off ? "cursor-default opacity-50" : "cursor-pointer"} ${on ? "border-im-logical bg-im-logical-soft" : "border-im-line"}`}>
              <input type="radio" name="import-channel" className="mt-1" checked={on} disabled={off} onChange={() => k !== "dbt" && set({ channel: k })} data-testid={`radio-channel-${k}`} />
              <span>
                <b className="block">{title}</b>
                <small className="block text-im-ink-3">{what}</small>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );

  const v = VENDORS[s.vendor];
  const input =
    s.channel === "file" ? (
      s.read ? (
        <ReadState s={s} onClear={clear} />
      ) : (
        <Drop onFile={fromFile} accept=".csv,.tsv,.txt,text/csv" testId="import-file">
          <span>
            Drop a CSV file here, or <u>choose one</u>
          </span>
          <span className="text-xs text-im-ink-3">Comma, semicolon or tab separated; one row per column</span>
        </Drop>
      )
    ) : s.channel === "query" ? (
      <>
        <label className="mb-2 block max-w-[320px]">
          <span className="mb-1 block text-[11.5px] text-im-ink-3">Database</span>
          <select value={s.vendor} onChange={(e) => set({ vendor: e.target.value as Vendor })} className={inputClass} data-testid="select-vendor">
            {(Object.keys(VENDORS) as Vendor[]).map((k) => (
              <option key={k} value={k}>
                {VENDORS[k].name}
              </option>
            ))}
            <option disabled>Snowflake (later)</option>
            <option disabled>Databricks (later)</option>
          </select>
        </label>
        <CodeBox
          head={
            <>
              <span className="font-mono">catalog_query.sql</span>
              <span className="text-im-ink-3">{v.name} · reads only the catalog, never your data</span>
              <span className="flex-1" />
              <CopyButton text={v.sql} testId="button-copy-query" />
            </>
          }
        >
          <textarea readOnly wrap="off" spellCheck={false} rows={14} value={v.sql} aria-label={`Catalog query for ${v.name}`} className={codeClass} data-testid="text-catalog-query" />
        </CodeBox>
        <p className={hintClass} data-testid="query-how">
          {v.how}
        </p>
        <h4 className="mb-1.5 mt-4 font-semibold">The result</h4>
        {s.read ? (
          <ReadState s={s} onClear={clear} />
        ) : (
          <>
            <CodeBox
              head={
                <>
                  <span className="text-im-ink-3">Paste the result with its header row</span>
                  <span className="flex-1" />
                  <button type="button" className={smallButtonClass} onClick={() => paste.trim() && takeText(paste, "pasted query result")} data-testid="button-read-paste">
                    Read it
                  </button>
                </>
              }
            >
              <textarea wrap="off" spellCheck={false} rows={6} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="database,schema,table,column,data_type,…" aria-label="The query result" className={codeClass} data-testid="input-paste-result" />
            </CodeBox>
            <Drop onFile={fromFile} accept=".csv,.tsv,.txt,text/csv" slim testId="query-file">
              <span>
                Or drop the saved CSV here, or <u>choose it</u>
              </span>
            </Drop>
          </>
        )}
      </>
    ) : (
      <DdlInput s={s} set={set} readScript={readScript} clear={clear} />
    );

  return (
    <div>
      {target}
      {channels}
      <section className={sectionClass}>{input}</section>
      <details className="mb-2" data-testid="details-standard">
        <summary className="cursor-pointer text-im-logical">InfoMapper’s source standard (v1)</summary>
        <p className={hintClass}>One row per column. Names of the columns as below; order does not matter. Other columns are ignored.</p>
        <p className={hintClass}>
          Flat files (Excel, CSV, TXT, JSON…) are described the same way: a made-up database and schema such as flat_files and ref_data, object_type file, the format in
          file_format, and the columns and types you know. Types may be logical: string(2), decimal(18,6), date.
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-[560px] text-left text-xs">
            <thead>
              <tr className="text-im-ink-3">
                <th className="py-1 pr-3 font-medium">Column</th>
                <th className="py-1 pr-3 font-medium">Required</th>
                <th className="py-1 font-medium">What it holds</th>
              </tr>
            </thead>
            <tbody>
              {STANDARD_INFO.map(([c, r, w]) => (
                <tr key={c} className="border-t border-im-line">
                  <td className="py-1 pr-3 font-mono">{c}</td>
                  <td className="py-1 pr-3">{r}</td>
                  <td className="py-1">{w}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2.5">
          <CodeBox
            head={
              <>
                <span className="font-mono">template.csv</span>
                <span className="text-im-ink-3">header row, a database table and a flat file</span>
                <span className="flex-1" />
                <CopyButton text={STANDARD_TEMPLATE} testId="button-copy-template" />
              </>
            }
          >
            <textarea readOnly wrap="off" spellCheck={false} rows={3} value={STANDARD_TEMPLATE} className={`${codeClass} min-h-0`} data-testid="text-template" />
          </CodeBox>
        </div>
      </details>
    </div>
  );
}

/** The DDL channel (items 16–18): a script, its Database and unqualified schema, then what was read. */
function DdlInput({ s, set, readScript, clear }: { s: WizardState; set: (patch: Partial<WizardState>) => void; readScript: (ddl: WizardState["ddl"]) => void; clear: () => void }) {
  const d = s.ddl;
  const setDdl = (patch: Partial<WizardState["ddl"]>) => set({ ddl: { ...d, ...patch } });
  const r = d.translation;
  if (s.read && r) {
    const skipped = skippedText(r.summary.skipped);
    return (
      <>
        {s.read.errors.length ? (
          <div className="my-2.5 rounded-lg bg-im-warn-soft px-3 py-2.5" data-testid="import-error">
            <b className="text-im-warn">Nothing to import.</b> {s.read.errors.join(" ")}{" "}
            <button type="button" className="text-im-logical underline" onClick={clear} data-testid="button-choose-another">
              Choose another
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2.5 rounded-lg bg-im-map-soft px-3 py-2.5" data-testid="import-loaded">
            <span className="min-w-0 flex-1">
              {ddlSummaryText(d.name || "DDL script", r.summary)}
              {r.warnings.length ? `, ${plural(r.warnings.length, "warning")} (shown in the review)` : ""}
            </span>
            <button type="button" className={smallButtonClass} onClick={clear} data-testid="button-choose-another">
              Choose another
            </button>
          </div>
        )}
        <p className={hintClass} data-testid="ddl-used">
          Database <b className="font-mono">{r.databases.join(", ") || "–"}</b>, schema for unqualified names <b className="font-mono">{r.defaultSchema}</b>.{skipped ? ` ${skipped}.` : ""}
        </p>
        <details className="mt-2" data-testid="details-translated">
          <summary className="cursor-pointer text-im-logical">The translated standard</summary>
          <p className={hintClass}>This is what the importer reads. If something is off, copy it, fix it in Excel or an editor and import it as a file.</p>
          <textarea readOnly wrap="off" spellCheck={false} value={r.standard} className={`${codeClass} mt-1.5 min-h-[160px]`} data-testid="text-translated-standard" />
          <p className="mt-1.5">
            <CopyButton text={r.standard} testId="button-copy-standard" label="Copy the standard" />
          </p>
        </details>
      </>
    );
  }
  return (
    <>
      <CodeBox
        head={
          <>
            <span className="font-mono">{d.name || "script.sql"}</span>
            <span className="text-im-ink-3">CREATE TABLE, ALTER TABLE … ADD, COMMENT ON, MS_Description</span>
            <span className="flex-1" />
            <button
              type="button"
              className={`${smallButtonClass} border-im-logical bg-im-logical text-im-surface hover:bg-im-logical`}
              onClick={() => d.text.trim() && readScript({ ...d, name: d.name || "pasted script" })}
              data-testid="button-read-ddl"
            >
              Read the script
            </button>
          </>
        }
      >
        <textarea
          wrap="off"
          spellCheck={false}
          rows={12}
          value={d.text}
          onChange={(e) => setDdl({ text: e.target.value })}
          placeholder="Paste an SSMS script, pg_dump --schema-only or DBMS_METADATA output"
          aria-label="The DDL script"
          className={codeClass}
          data-testid="input-ddl"
        />
      </CodeBox>
      <Drop onFile={(file) => void file.text().then((text) => readScript({ ...d, text, name: file.name }))} accept=".sql,.ddl,.txt" slim testId="ddl-file">
        <span>
          Or drop a .sql file here, or <u>choose one</u>
        </span>
      </Drop>
      <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11.5px] text-im-ink-3">Database</span>
          <input type="text" value={d.database} onChange={(e) => setDdl({ database: e.target.value })} placeholder="From USE, or the file name" className={inputClass} data-testid="input-ddl-database" />
          <span className={hintClass}>For a script without USE or three-part names.</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] text-im-ink-3">Schema for unqualified names</span>
          <input type="text" value={d.schema} onChange={(e) => setDdl({ schema: e.target.value })} placeholder="Guessed: dbo or public" className={inputClass} data-testid="input-ddl-schema" />
          <span className={hintClass}>For tables named without a schema.</span>
        </label>
      </div>
      <p className={hintClass}>Views are skipped (DDL does not give their column types), and so are indexes, sequences, grants and storage clauses.</p>
    </>
  );
}
