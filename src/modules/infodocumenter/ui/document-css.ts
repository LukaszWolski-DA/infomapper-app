// A document's own CSS (slice 25, step 4): the prototype's `DOC` styles for the content and its `pagedCSS` for the pages,
// A4 portrait only. Handed to Paged.js with the content (`paged-view.tsx`), which turns the `@page` rules into its page
// boxes and inserts the rest into the page's head while the document is open. The running header and footer (D3): top
// left "{organization} · {title}", top centre the watermark (D2), bottom left "{workspace} · {model state}", bottom right
// "Page n of m"; nothing on the title page (its own named page). Every section starts a page (D6). The paper is always
// light: it is a document, whatever the app's theme. The paper's variables are on the pages too: Paged.js lays out the
// source's content, not its root element.
//
// Texts from the model (the organization's, the title, the workspace's) go into CSS strings, escaped by `cssString`.

import type { DocumentFrame } from "../domain/document";
import type { DocumentStyle } from "../domain/types";

/** The papers in millimetres, portrait (the prototype's `PAPER`). */
export const PAPER_MM: Readonly<Record<DocumentStyle["paper"], readonly [number, number]>> = { A4: [210, 297], A3: [297, 420] };

/** A style's page in millimetres: its paper, turned for landscape. */
export function pageSize(style: Pick<DocumentStyle, "paper" | "orientation">): { w: number; h: number } {
  const [w, h] = PAPER_MM[style.paper];
  return style.orientation === "landscape" ? { w: h, h: w } : { w, h };
}

/** The accent colours (the prototype's `ACC`); black and white overrides them. */
export const ACCENT_COLOURS: Readonly<Record<DocumentStyle["accent"], string>> = { indigo: "#3346C4", teal: "#0B7A66", graphite: "#33404F", burgundy: "#8A2F3C" };

/** The style a slice 25 page had: what `documentCss` draws without a style. */
const PLAIN: Pick<DocumentStyle, "paper" | "orientation" | "template" | "accent" | "colours" | "banded" | "numbers"> = {
  paper: "A4",
  orientation: "portrait",
  template: "standard",
  accent: "indigo",
  colours: "colour",
  banded: false,
  numbers: false,
};
type LookStyle = typeof PLAIN;

/** A CSS string literal: quotes, backslashes and line breaks escaped, so a name ends nowhere but at its own quote. */
export const cssString = (text: string): string => `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n\f]+/g, " ")}"`;

/** The page's margin in millimetres (the prototype's `MARG`). */
export const PAGE_MARGIN_MM = 18;

/**
 * A frame field as a CSS `content` value (slice 26): its text parts as escaped strings, `{page}` and `{pages}` as the
 * page counters; `none` when it is empty.
 */
export function frameContent(text: string): string {
  if (!text) return "none";
  const parts = text.split(/(\{page\}|\{pages\})/).filter(Boolean);
  return parts.map((p) => (p === "{page}" ? "counter(page)" : p === "{pages}" ? "counter(pages)" : cssString(p))).join(" ");
}

/** A frame field on the quick sheet (D8): the page tokens as "–". */
export const frameQuickText = (text: string): string => text.replace(/\{pages?\}/g, "–");

/**
 * The page rules Paged.js lays out with: the style's paper and orientation (slice 26, step 4: one size per document;
 * Paged.js's `@page size`), the margin boxes and the breaks; the title page fills the page's height less its margins.
 */
export function pageCss(frame: DocumentFrame, style: Pick<DocumentStyle, "paper" | "orientation" | "colours"> = PLAIN): string {
  const margin = "font-family:var(--font-plex-sans),sans-serif;font-size:7.5pt;color:#7C8794;";
  const { h } = pageSize(style);
  return `
@page{size:${style.paper} ${style.orientation};margin:${PAGE_MARGIN_MM}mm ${PAGE_MARGIN_MM}mm 20mm ${PAGE_MARGIN_MM}mm;
@top-left{content:${frameContent(frame.headerLeft)};${margin}vertical-align:bottom;padding-bottom:3mm;white-space:nowrap}
@top-center{content:${frameContent(frame.watermark)};${margin}color:${style.colours === "mono" ? "#111111" : "#B23A0B"};font-weight:600;vertical-align:bottom;padding-bottom:3mm}
@top-right{content:${frameContent(frame.headerRight)};${margin}vertical-align:bottom;padding-bottom:3mm;text-align:right}
@bottom-left{content:${frameContent(frame.footerLeft)};${margin}vertical-align:top;padding-top:4mm}
@bottom-right{content:${frameContent(frame.footerRight)};${margin}vertical-align:top;padding-top:4mm;text-align:right}}
@page cover{@top-left{content:none}@top-center{content:none}@top-right{content:none}@bottom-left{content:none}@bottom-right{content:none}}
.dcover{page:cover}
section.dsheet{break-before:page}
section.dsheet:first-of-type{break-before:auto}
.dpb{break-before:page}
tbody.dat,table.dt tr{break-inside:avoid}
.dsheet h2,.dsec h2,.dh3,.dsec h4,.dsec h5,.dmeta,.ddef{break-after:avoid}
.dent.keep,.dattrc,.dreq,table.dt.ready,table.dt.narrow,.dnotes li,.dlist li{break-inside:avoid}
.dtoc a::after{content:target-counter(attr(href), page)}
.dcover{min-height:${h - PAGE_MARGIN_MM - 20 - 11}mm}
`;
}

/** The document's whole CSS for Paged.js: its page rules, its look, and the style's (slice 26). */
export const documentCss = (frame: DocumentFrame, style: LookStyle = PLAIN): string => pageCss(frame, style) + DOCUMENT_LOOK_CSS + styleCss(style);

/**
 * A style's look (slice 26, step 4; the prototype's `tpl-*`, `acc-*`, `th-mono`, `zebra` rules). Written without a root
 * class, since Paged.js lays out the source's content and not its root element: the rules are the chosen style's only.
 * Headings, tables, captions and meta lines stay sans serif in every template.
 */
export function styleCss(style: LookStyle): string {
  const mono = style.colours === "mono";
  const accent = mono ? "#111111" : ACCENT_COLOURS[style.accent];
  const out = [`.dpages,.pagedjs_page{--dacc:${accent};--dsoft:${mono ? "#F2F2F2" : "#F3F5F8"}}`];
  if (style.template === "formal")
    out.push(`
.dpages,.pagedjs_page{font-family:var(--font-plex-serif),"IBM Plex Serif",Georgia,"Times New Roman",serif;font-size:10.5pt;line-height:1.6}
.dsheet h2,.dsec h2,.dh3,.dsec h4,.dsec h5,table.dt,.dmeta,.dtoc,.dcovt,.dorg{font-family:var(--font-plex-sans),sans-serif}
.dsheet h2,.dsec h2{font-weight:500;font-size:16pt;padding-bottom:1.5mm;border-bottom:.6px solid var(--dacc)}
.dcover{justify-content:center;padding-bottom:18mm}
.dcover h1{font-family:var(--font-plex-serif),"IBM Plex Serif",Georgia,serif;font-weight:500;font-size:28pt;border-top:2px solid var(--dacc);border-bottom:.6px solid var(--dacc);padding:6mm 0;margin-bottom:5mm;max-width:none}
.dcover .dorg{border-bottom:none;padding-bottom:0;margin-bottom:40mm}
.dsub{font-family:var(--font-plex-serif),"IBM Plex Serif",Georgia,serif;font-style:italic}
table.dt th{border-bottom-width:.8px}
.ddef,.dsheet p,.dsec p{font-size:10.5pt}`);
  if (style.template === "compact")
    out.push(`
.dpages,.pagedjs_page{font-size:9pt;line-height:1.4}
.dsheet h2,.dsec h2{font-size:12.5pt;margin-top:6mm}
.dsec:first-child h2,.dsheet>.dsec:first-child h2{margin-top:0}
table.dt{font-size:7.8pt}
table.dt th{background:var(--dsoft);border-bottom:1.2px solid var(--dacc);padding:1mm 1.5mm}
table.dt td{padding:.8mm 1.5mm}
.dcover h1{font-size:20pt}
.dh3{font-size:10pt;margin-top:4mm}`);
  if (mono)
    out.push(`
.dchip.pii,.dchip.bk{color:#111;background:#E6E6E6}
.dwarn{color:#111;font-style:italic}
.dst,.dst.draft,.dst.review,.dst.approved{background:#EDEDED;color:#111}
.dbar i{background:#333}
.dok{color:#111}
.dsw{background:#777!important}
.dent[data-mark]>h4:first-child{border-left-color:#777}
.dent[data-mark]{--cc:#777}`);
  // banded rows: the renderer marks every second row (CSS's nth-child would restart where Paged.js continues a table)
  if (style.banded) out.push(`table.dt tbody.even td{background:var(--dsoft)}`);
  if (style.numbers) out.push(`.dnum{color:var(--dacc);margin-right:2.5mm;font-variant-numeric:tabular-nums}`);
  else out.push(`.dnum{display:none}`);
  return out.join("\n");
}

/** How the document's content looks, on the pages and on the quick sheet alike (slice 26, P3). */
export const DOCUMENT_LOOK_CSS = `

.dpages,.pagedjs_page{--paper:#FFFFFF;--dink:#1B222B;--dink2:#4B5562;--dink3:#7C8794;--dline:#D9DEE4;--dacc:#3346C4;
  color:var(--dink);font:10pt/1.5 var(--font-plex-sans),sans-serif;color-scheme:light}
.dsheet h2,.dsec h2{font-size:15pt;font-weight:600;margin:0 0 4mm;color:var(--dink)}
.dh3{font-size:11.5pt;font-weight:600;margin:6mm 0 2.5mm}
.dsheet h4,.dsec h4{font-size:10.5pt;font-weight:600;margin:5mm 0 1mm}
.dsheet h5,.dsec h5{font-size:9pt;font-weight:600;color:var(--dink2);margin:3mm 0 1mm}
.dsheet p,.dsec p{margin:0 0 3mm;max-width:165mm}
.dmeta{font-size:8.5pt;color:var(--dink3);margin-bottom:1.5mm}
.dmuted{color:var(--dink3)}
.dwarn{color:#B23A0B}
.dmono{font-family:var(--font-plex-mono),monospace;font-size:.94em}
.dnote{color:var(--dink3);font-style:italic;border:1px dashed var(--dline);padding:3mm;border-radius:1.5mm}
table.dt{width:100%;border-collapse:collapse;font-size:8.5pt;margin:1mm 0 3mm}
table.dt th{text-align:left;font-weight:600;color:var(--dink2);border-bottom:1.2px solid var(--dink2);padding:1.2mm 2mm 1.2mm 0;vertical-align:bottom}
table.dt td{border-bottom:.6px solid var(--dline);padding:1.2mm 2mm 1.2mm 0;vertical-align:top}
table.dt tr.hasdef td{border-bottom:0}
table.dt tr.ddr td{color:var(--dink2);padding-top:0}
table.dt thead{display:table-header-group}
.dt td b{white-space:nowrap}
.dst{font-size:7.5pt;font-weight:600;padding:0 1.5mm;border-radius:.8mm;white-space:nowrap;background:#EDEDED;color:#333}
.dst.draft{background:#FCEADD;color:#9A3412}.dst.review{background:#E7EAFB;color:#3346C4}.dst.approved{background:#DCF1EB;color:#0B6B59}
.dcover{display:flex;flex-direction:column;justify-content:flex-end;padding-bottom:20mm}
.dcover .dorg{font-size:10pt;color:var(--dink3);margin-bottom:auto;padding-bottom:20mm;border-bottom:2px solid var(--dacc);width:100%}
.dcover h1{font-size:26pt;line-height:1.15;font-weight:600;margin:0 0 3mm;max-width:150mm;letter-spacing:-.01em}
.dsub{font-size:13pt;color:var(--dink2);margin-bottom:12mm}
.dcovt{border-collapse:collapse;font-size:9.5pt;width:auto}
.dcovt th{text-align:left;font-weight:500;color:var(--dink3);padding:1mm 8mm 1mm 0}
.dcovt td{padding:1mm 0}
.dtoc ol{list-style:none;padding:0;margin:0 0 6mm;font-size:11pt}
.dtoc li{padding:1.6mm 0;border-bottom:.6px solid var(--dline)}
.dtoc li a{display:flex;gap:3mm;color:inherit;text-decoration:none}
.dtoc li a::after{margin-left:auto;color:var(--dink3);font-variant-numeric:tabular-nums}
/* slice 26: the prototype's styles of the sections without figures */
.ddef{font-size:9.5pt;color:var(--dink2);margin-bottom:2mm;max-width:165mm}
.dent{margin-bottom:4mm}
.dent[data-mark]>h4:first-child{border-left:1.2mm solid var(--cc);padding-left:2.5mm;margin-left:-3.7mm}
.dsw{display:inline-block;width:3mm;height:3mm;border-radius:.8mm;margin-right:2mm;vertical-align:-.2mm}
table.dt.narrow{width:auto;min-width:90mm}
table.dt.fixed{table-layout:fixed}
table.dt.fixed td{overflow-wrap:anywhere}
.dchip{font-size:7.5pt;font-weight:600;padding:0 1.2mm;border-radius:.8mm;background:#EDEDED;color:#333;white-space:nowrap}
.dchip.pii{color:#B23A0B;background:#FCEADD}
.dchip.bk{color:#A0660F;background:#F6ECDA}
.dchip.key{font-family:var(--font-plex-mono),monospace;font-weight:500;color:var(--dacc);background:none;padding:0;font-size:.92em}
.dbar{display:inline-block;width:14mm;height:1.6mm;border-radius:1mm;background:var(--dline);vertical-align:middle;overflow:hidden}
.dbar i{display:block;height:100%;background:#0B8A72}
.dconcepts{display:grid;gap:1.5mm;margin-top:3mm}
.dcon{font-size:9.5pt}
.dwide{overflow-x:auto}
table.dt.bus td,table.dt.bus th{text-align:center;padding-right:1mm}
table.dt.bus td:first-child,table.dt.bus th:first-child{text-align:left}
.dvert{writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;font-weight:500}
.dok{color:#0B7A66;font-weight:600}
.dlist{margin:0 0 3mm;padding-left:5mm;font-size:9pt;columns:2;column-gap:8mm}
.dlist li{margin-bottom:.6mm}
.ddv{margin:0 0 2mm;padding-left:5mm;font-size:9pt}
table.dt.conv td:first-child{width:28mm;vertical-align:middle}
table.dt.conv svg{display:block}
table.dt.ready td:last-child{width:22mm;text-align:right}
table.dt.ready th:last-child{text-align:right}
.dacs{display:grid;gap:2.2mm;margin:1mm 0 3mm}
.dattrc{border-left:.8mm solid var(--dline);padding:.6mm 0 .6mm 3mm}
.dac-h{display:flex;flex-wrap:wrap;gap:1mm 3mm;align-items:baseline;font-size:9pt}
.dac-h b{font-family:var(--font-plex-mono),monospace;font-weight:600}
.dac-h>span{color:var(--dink2);font-size:8.5pt}
.dac-d{font-size:9.5pt;color:var(--dink);margin-top:.6mm;max-width:165mm}
.dac-m{font-size:8.5pt;color:var(--dink2);margin-top:.4mm}
.dac-m>span{color:var(--dink3)}
.dref{font-size:8.5pt;color:var(--dacc);font-style:italic}
.dnotes{padding-left:6mm;font-size:9pt}
.dnotes li{margin-bottom:2mm}
.dreq{margin:0 0 4.5mm;padding-bottom:3mm;border-bottom:.6px solid var(--dline)}
.dsec .dreq h4{margin:0 0 1mm}
.dreqm{display:flex;flex-wrap:wrap;gap:.6mm 5mm;font-size:8.5pt;color:var(--dink2);margin-bottom:1.5mm}
`;

/**
 * The quick sheet (slice 26, F3, P3): the same content and look at the page's width, one sheet per page break with a
 * faint line every page height, the watermark at the top, the footer fields' text after the last sheet (D8). Scoped to
 * `.dquick`, so it never touches the laid-out pages. The style's paper and orientation (step 4); Compact's narrower
 * padding (the prototype's 14 mm).
 */
export function quickSheetCss(style: Pick<DocumentStyle, "paper" | "orientation" | "template"> = { ...PLAIN }): string {
  const { w, h } = pageSize(style);
  const pad = style.template === "compact" ? 14 : PAGE_MARGIN_MM;
  return `
.dquick{display:flex;flex-direction:column;align-items:center;gap:8mm;position:relative}
.dquick .dsheet{box-sizing:border-box;width:${w}mm;min-height:${h}mm;padding:${pad}mm;background:#fff;
  background-image:repeating-linear-gradient(to bottom,transparent 0,transparent calc(${h}mm - 1px),#C9D1DA calc(${h}mm - 1px),#C9D1DA ${h}mm);
  box-shadow:0 1px 3px rgba(0,0,0,.12),0 10px 30px -18px rgba(0,0,0,.35)}
.dquick .dcover{min-height:${h}mm}
.dquick .dsec+.dsec{margin-top:6mm}
.dquick .dwm{position:sticky;top:0;align-self:flex-end;z-index:1;font:600 9pt var(--font-plex-sans),sans-serif;color:#B23A0B;margin-bottom:-8mm;padding:2mm 4mm}
.dquick .dfoot{font:7.5pt var(--font-plex-sans),sans-serif;color:#7C8794;text-align:center}
`;
}

/**
 * The app's own CSS for the laid-out pages (not handed to Paged.js): the pages as sheets on the screen, and in print the
 * pages alone, every other element of the page hidden and its ancestors unclipped.
 */
export const PAGES_SCREEN_CSS = `
.im-doc-host .pagedjs_pages{display:flex;flex-direction:column;align-items:center}
.im-doc-host .pagedjs_page{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.12),0 10px 30px -18px rgba(0,0,0,.35);margin:0 0 8mm;flex:none}
@media print{
  body *:not(:has(.im-doc-host)):not(.im-doc-host):not(.im-doc-host *){display:none!important}
  body *:has(.im-doc-host){display:block!important;overflow:visible!important;height:auto!important;min-height:0!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;position:static!important;background:#fff!important;box-shadow:none!important}
  html,body{background:#fff!important;height:auto!important;overflow:visible!important}
  .im-doc-host .pagedjs_page{box-shadow:none!important;margin:0!important}
}
`;
