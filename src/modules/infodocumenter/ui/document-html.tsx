// The HTML of a document's content tree (slice 25, step 4; step 3's deviation): plain React elements, no state, so every
// text from the model, a definition or a recipe is a text node React escapes (never HTML built from strings, never
// `dangerouslySetInnerHTML`). The page lays these sections out in A4 pages with Paged.js (`paged-view.tsx`); the classes
// are the prototype's `DOC` ones (`document-css.ts`).

import type { ReactNode } from "react";
import type { DocNode, DocRow, DocRun, DocRuns } from "@/domain/document/content";
import type { DocumentTree } from "../domain/document";
import { frameQuickText } from "./document-css";

function Run({ run }: { run: DocRun }) {
  let el: ReactNode = run.text;
  if (run.pill) el = <span className={`dst${run.status ? ` ${run.status}` : ""}`}>{el}</span>;
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

function Row({ row, span }: { row: DocRow; span: number }) {
  return (
    <tbody className="dat">
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

function Node({ node }: { node: DocNode }) {
  switch (node.kind) {
    case "heading": {
      // level 1 is the section's own heading (h2); 2 to 4 within it
      if (node.level === 1) return <h2 id={node.anchor}>{node.text}</h2>;
      if (node.level === 2) return <h3 className="dh3">{node.text}</h3>;
      return node.level === 3 ? <h4>{node.text}</h4> : <h5>{node.text}</h5>;
    }
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
      return (
        <table className="dt">
          <thead>
            <tr>
              {node.columns.map((c) => (
                <th key={c.key} style={c.width ? { width: `${c.width}%` } : undefined}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          {node.rows.map((r, i) => (
            <Row key={i} row={r} span={node.columns.length} />
          ))}
        </table>
      );
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
  const cover = (
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
  const contents = (
    <section className="dsheet dtoc" data-testid="document-contents" data-sec="doc">
      <h2>{tree.contents.heading}</h2>
      <ol>
        {tree.contents.entries.map((e) => (
          <li key={e.anchor}>
            <a href={`#${e.anchor}`}>{e.text}</a>
          </li>
        ))}
      </ol>
      {tree.skipped.map((s) => (
        <p key={s.id} className="dnote" data-testid="document-skipped">
          {s.text}
        </p>
      ))}
    </section>
  );
  const section = (s: DocumentTree["sections"][number], sheet: boolean) => (
    <section key={s.id} className={sheet ? "dsheet dsec" : "dsec"} data-section={s.type} data-sec={s.id} data-testid="document-section">
      <h2 id={s.anchor}>{s.heading}</h2>
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
