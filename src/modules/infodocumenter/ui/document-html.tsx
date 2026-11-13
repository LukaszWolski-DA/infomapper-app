// The HTML of a document's content tree (slice 25, step 4; step 3's deviation): plain React elements, no state, so every
// text from the model, a definition or a recipe is a text node React escapes (never HTML built from strings, never
// `dangerouslySetInnerHTML`). The page lays these sections out in A4 pages with Paged.js (`paged-view.tsx`); the classes
// are the prototype's `DOC` ones (`document-css.ts`).

import type { CSSProperties, ReactNode } from "react";
import type { DocNode, DocRow, DocRun, DocRuns } from "@/domain/document/content";
import type { DocumentTree } from "../domain/document";
import { frameQuickText } from "./document-css";

/** The prototype's palette for the small drawings (`PAL.color`). */
const INK = { rel: "#556273", line: "#D6DCE3", map: "#0B8A72", warn: "#C2410C", ink3: "#7C8998" };

/**
 * A relationship end in a notation (slice 26, the conventions' table; the prototype's `ieMarker`, `umlMarker`): a line
 * to a box, the end drawn at the box. Crow's foot: a bar for one, a circle for zero, a foot for many; UML: the
 * multiplicity in words.
 */
function EndMark({ end }: { end: NonNullable<DocRun["end"]> }) {
  const x = 86;
  const crow = end.notation === "ie";
  return (
    <svg className="dsvg" viewBox="0 0 110 24" width="110" height="24" aria-hidden>
      <path d={`M4 12H${x}`} stroke={INK.rel} strokeWidth="1.6" />
      <rect x={x} y="2" width="20" height="20" rx="3" fill="#fff" stroke={INK.line} />
      {crow ? (
        <g fill="none" stroke={INK.rel} strokeWidth="1.6">
          {end.many ? <path d={`M${x - 12} 12L${x} 5M${x - 12} 12L${x} 19M${x - 12} 12H${x}`} /> : <path d={`M${x - 8} 5V19`} />}
          {end.min === 0 ? <circle cx={x - 20} cy="12" r="4.5" fill="#fff" /> : <path d={`M${x - 18} 5V19`} />}
        </g>
      ) : (
        <text x={x - 14} y="7" fontSize="10" textAnchor="middle" fill={INK.rel}>
          {end.many ? (end.min ? "1..*" : "0..*") : end.min ? "1" : "0..1"}
        </text>
      )}
    </svg>
  );
}

/** A mapping line in its status's dash (the prototype's `ln`). */
const LineMark = ({ status }: { status: NonNullable<DocRun["line"]> }) => (
  <svg viewBox="0 0 60 12" width="60" height="12" aria-hidden>
    <path d="M2 6H58" stroke={INK.map} strokeWidth="1.6" strokeDasharray={status === "draft" ? "6 4" : status === "review" ? "10 3 2 3" : undefined} />
  </svg>
);

/** A mark in a circle (the prototype's `chp`). */
const CircleMark = ({ text, tone }: { text: string; tone: NonNullable<DocRun["circle"]> }) => {
  const c = tone === "warn" ? INK.warn : INK.map;
  return (
    <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden>
      <circle cx="9" cy="9" r="7.5" fill="#fff" stroke={c} strokeWidth="1.4" />
      <text x="9" y="9.5" fontSize="9" fontWeight="600" textAnchor="middle" dominantBaseline="central" fill={c}>
        {text}
      </text>
    </svg>
  );
};

/** The row's fed and not-fed dots. */
const Dots = () => (
  <svg viewBox="0 0 30 12" width="30" height="12" aria-hidden>
    <circle cx="7" cy="6" r="4.5" fill={INK.map} />
    <circle cx="21" cy="6" r="4" fill="none" stroke={INK.ink3} strokeWidth="1.4" />
  </svg>
);

function Run({ run }: { run: DocRun }) {
  let el: ReactNode = run.text;
  if (run.end) el = <EndMark end={run.end} />;
  else if (run.line) el = <LineMark status={run.line} />;
  else if (run.dots) el = <Dots />;
  else if (run.circle) el = <CircleMark text={run.text} tone={run.circle} />;
  else if (run.swatch) el = <span className="dsw" style={{ background: run.swatch }} />;
  else if (run.bar)
    el = (
      <>
        <span className="dbar">
          <i style={{ width: `${run.bar.total ? (run.bar.ok / run.bar.total) * 100 : 0}%` }} />
        </span>
        {run.text}
      </>
    );
  else if (run.chip) el = <span className={`dchip ${run.chip}`}>{el}</span>;
  else if (run.ok) el = <span className="dok">{el}</span>;
  else if (run.ref) el = <span className="dref">{el}</span>;
  else if (run.pill) el = <span className={`dst${run.status ? ` ${run.status}` : ""}`}>{el}</span>;
  else {
    const cls = [run.mono && "dmono", run.muted && "dmuted", run.warn && "dwarn"].filter(Boolean).join(" ");
    if (cls) el = <span className={cls}>{el}</span>;
    if (run.strong) el = <b>{el}</b>;
  }
  return (
    <>
      {run.lineBreak && <br />}
      {el}
    </>
  );
}

export function Runs({ runs }: { runs: DocRuns }) {
  return (
    <>
      {runs.map((r, i) => (
        <Run key={i} run={r} />
      ))}
    </>
  );
}

function Row({ row, span, even }: { row: DocRow; span: number; even: boolean }) {
  return (
    <tbody className={even ? "dat even" : "dat"}>
      <tr className={row.below?.length ? "hasdef" : undefined}>
        {row.cells.map((c, i) => (
          <td key={i}>
            <Runs runs={c} />
          </td>
        ))}
      </tr>
      {row.below?.map((b, i) => (
        <tr key={i} className="ddr">
          <td colSpan={span}>
            <Runs runs={b} />
          </td>
        </tr>
      ))}
    </tbody>
  );
}

const TABLE_CLASS: Record<NonNullable<Extract<DocNode, { kind: "table" }>["style"]>, string> = {
  narrow: "narrow",
  fixed: "fixed",
  checks: "ready",
  legend: "conv narrow",
  matrix: "bus",
};

function Table({ node }: { node: Extract<DocNode, { kind: "table" }> }) {
  const table = (
    <table className={`dt${node.style ? ` ${TABLE_CLASS[node.style]}` : ""}`}>
      {node.style === "fixed" && (
        <colgroup>
          {node.columns.map((c) => (
            <col key={c.key} style={c.width ? { width: `${c.width}%` } : undefined} />
          ))}
        </colgroup>
      )}
      <thead>
        <tr>
          {node.columns.map((c) => (
            <th key={c.key} style={c.width && node.style !== "fixed" ? { width: `${c.width}%` } : undefined}>
              {c.vertical ? <span className="dvert">{c.label}</span> : c.label}
            </th>
          ))}
        </tr>
      </thead>
      {node.rows.map((r, i) => (
        <Row key={i} row={r} span={node.columns.length} even={i % 2 === 1} />
      ))}
    </table>
  );
  return node.style === "matrix" ? <div className="dwide">{table}</div> : table;
}

function Heading({ node }: { node: Extract<DocNode, { kind: "heading" }> }) {
  const swatch = node.swatch ? <span className="dsw" style={{ background: node.swatch }} /> : null;
  // level 1 is the section's own heading (h2); 2 to 4 within it
  if (node.level === 1) return <h2 id={node.anchor}>{node.text}</h2>;
  if (node.level === 2)
    return (
      <h3 className="dh3">
        {node.number && <span className="dnum">{node.number}</span>}
        {swatch}
        {node.text}
      </h3>
    );
  return node.level === 3 ? <h4>{node.text}</h4> : <h5>{node.text}</h5>;
}

function Node({ node }: { node: DocNode }) {
  switch (node.kind) {
    case "heading":
      return <Heading node={node} />;
    case "list": {
      const items = node.items.map((item, i) => (
        <li key={i} className={item.muted ? "dmuted" : undefined}>
          {item.label && <Runs runs={item.label} />}
          <Runs runs={item.runs} />
        </li>
      ));
      if (node.plain) return <div className="dconcepts">{node.items.map((item, i) => <div key={i} className="dcon"><Runs runs={item.runs} /></div>)}</div>;
      if (node.ordered) return <ol className="dnotes">{items}</ol>;
      return <ul className={node.columns === 2 ? "dlist" : "ddv"}>{items}</ul>;
    }
    case "cards":
      if (node.variant === "requirement")
        return (
          <>
            {node.cards.map((c, i) => (
              <div key={i} className="dreq">
                <h4>
                  <Runs runs={c.title} />
                </h4>
                {c.props.length > 0 && (
                  <div className="dreqm">
                    {c.props.map((p, j) => (
                      <span key={j}>
                        <Runs runs={p} />
                      </span>
                    ))}
                  </div>
                )}
                {c.lines.map((l, j) => (
                  <div key={j} className="dmeta">
                    {l.label && `${l.label} `}
                    <Runs runs={l.runs} />
                  </div>
                ))}
                {c.text && (
                  <div className="ddef">
                    <Runs runs={c.text} />
                  </div>
                )}
              </div>
            ))}
          </>
        );
      return (
        <div className="dacs">
          {node.cards.map((c, i) => (
            <div key={i} className="dattrc">
              <div className="dac-h">
                <b>
                  <Runs runs={c.title} />
                </b>
                {c.props.map((p, j) => (
                  <span key={j}>
                    <Runs runs={p} />
                  </span>
                ))}
              </div>
              {c.text && (
                <div className="dac-d">
                  <Runs runs={c.text} />
                </div>
              )}
              {c.lines.map((l, j) => (
                <div key={j} className="dac-m">
                  <span>{l.label}:</span> <Runs runs={l.runs} />
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    case "group":
      return (
        <div className={`dent${node.keep ? " keep" : ""}`} style={node.mark ? ({ "--cc": node.mark } as CSSProperties) : undefined} data-mark={node.mark ? "" : undefined}>
          <Nodes nodes={node.nodes} />
        </div>
      );
    case "paragraph":
      return (
        <p>
          <Runs runs={node.runs} />
        </p>
      );
    case "meta":
      return (
        <div className="dmeta">
          {node.parts.map((p, i) => (
            <span key={i}>
              {i > 0 && " · "}
              <Runs runs={p} />
            </span>
          ))}
        </div>
      );
    case "table":
      return <Table node={node} />;
    case "note":
      return <p className="dnote">{node.text}</p>;
    case "pageBreak":
      return <div className="dpb" />;
  }
}

export function Nodes({ nodes }: { nodes: readonly DocNode[] }) {
  return (
    <>
      {nodes.map((n, i) => (
        <Node key={i} node={n} />
      ))}
    </>
  );
}

/**
 * The whole document: the title page (a named page without header, footer or watermark), the contents with the
 * skipped sections' notes, then each section, on a new page unless it runs on (slice 26). `id` is the source Paged.js
 * lays out. Every part carries `data-sec` (a section's id, "doc" for the title page and the contents), which the
 * editor's preview selects by (P5).
 *
 * `quick` (slice 26, F3): the quick sheet, one `.dsheet` per page break holding the sections that run on in it, the
 * watermark at the top and the footer fields' text after the last sheet, page numbers as "–" (D8).
 */
export function DocumentHtml({ tree, id, quick }: { tree: DocumentTree; id?: string; quick?: boolean }) {
  // slice 26, step 4: the style's title page and contents switches; the skipped sections' notes stay without contents
  const notes = tree.skipped.map((s) => (
    <p key={s.id} className="dnote" data-testid="document-skipped">
      {s.text}
    </p>
  ));
  const cover = !tree.style.cover ? null : (
    <section className="dsheet dcover" data-testid="document-cover" data-sec="doc">
      <div className="dorg">{tree.cover.organization}</div>
      <h1>{tree.cover.title}</h1>
      {tree.cover.subtitle && <div className="dsub">{tree.cover.subtitle}</div>}
      <table className="dcovt">
        <tbody>
          {tree.cover.rows.map((r) => (
            <tr key={r.key} data-testid={`cover-${r.key}`}>
              <th>{r.label}</th>
              <td>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
  const contents = !tree.style.contents ? (
    notes.length ? <div data-sec="doc">{notes}</div> : null
  ) : (
    <section className="dsheet dtoc" data-testid="document-contents" data-sec="doc">
      <h2>{tree.contents.heading}</h2>
      <ol>
        {tree.contents.entries.map((e) => (
          <li key={e.anchor}>
            <a href={`#${e.anchor}`}>
              {e.number && <span className="dnum">{e.number}</span>}
              {e.text}
            </a>
          </li>
        ))}
      </ol>
      {notes}
    </section>
  );
  const section = (s: DocumentTree["sections"][number], sheet: boolean) => (
    <section key={s.id} className={sheet ? "dsheet dsec" : "dsec"} data-section={s.type} data-sec={s.id} data-testid="document-section">
      <h2 id={s.anchor}>
        {s.number && <span className="dnum">{s.number}</span>}
        {s.heading}
      </h2>
      <Nodes nodes={s.nodes} />
    </section>
  );
  if (!quick)
    return (
      <div id={id} className="dpages" lang={tree.language} data-testid="document-source">
        {cover}
        {contents}
        {tree.sections.map((s, i) => section(s, i === 0 || s.newPage))}
      </div>
    );
  // the quick sheet: the sections grouped by their page breaks
  const sheets: DocumentTree["sections"][number][][] = [];
  tree.sections.forEach((s, i) => {
    if (i === 0 || s.newPage || !sheets.length) sheets.push([s]);
    else sheets[sheets.length - 1]!.push(s);
  });
  const footer = [tree.frame.footerLeft, tree.frame.footerRight].map(frameQuickText).filter(Boolean).join(" · ");
  return (
    <div id={id} className="dpages dquick" lang={tree.language} data-testid="document-quick">
      {tree.frame.watermark && <div className="dwm">{tree.frame.watermark}</div>}
      {cover}
      {contents}
      {sheets.map((group) => (
        <div key={group[0]!.id} className="dsheet" data-testid="quick-sheet">
          {group.map((s) => section(s, false))}
        </div>
      ))}
      {footer && (
        <div className="dfoot" data-testid="quick-footer">
          {footer}
        </div>
      )}
    </div>
  );
}
