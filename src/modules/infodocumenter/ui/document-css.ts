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

/** The page rules Paged.js lays out with (A4 portrait until step 4's style): the margin boxes and the breaks. */
export function pageCss(frame: DocumentFrame): string {
  const margin = "font-family:var(--font-plex-sans),sans-serif;font-size:7.5pt;color:#7C8794;";
  return `
@page{size:A4 portrait;margin:${PAGE_MARGIN_MM}mm ${PAGE_MARGIN_MM}mm 20mm ${PAGE_MARGIN_MM}mm;
@top-left{content:${frameContent(frame.headerLeft)};${margin}vertical-align:bottom;padding-bottom:3mm;white-space:nowrap}
@top-center{content:${frameContent(frame.watermark)};${margin}color:#B23A0B;font-weight:600;vertical-align:bottom;padding-bottom:3mm}
@top-right{content:${frameContent(frame.headerRight)};${margin}vertical-align:bottom;padding-bottom:3mm;text-align:right}
@bottom-left{content:${frameContent(frame.footerLeft)};${margin}vertical-align:top;padding-top:4mm}
@bottom-right{content:${frameContent(frame.footerRight)};${margin}vertical-align:top;padding-top:4mm;text-align:right}}
@page cover{@top-left{content:none}@top-center{content:none}@top-right{content:none}@bottom-left{content:none}@bottom-right{content:none}}
.dcover{page:cover}
section.dsheet{break-before:page}
section.dsheet:first-of-type{break-before:auto}
.dpb{break-before:page}
tbody.dat,table.dt tr{break-inside:avoid}
.dsheet h2,.dsec h2,.dh3,.dsec h4,.dsec h5,.dmeta{break-after:avoid}
.dtoc a::after{content:target-counter(attr(href), page)}
`;
}

/** The document's whole CSS for Paged.js: its page rules and its look. */
export const documentCss = (frame: DocumentFrame): string => pageCss(frame) + DOCUMENT_LOOK_CSS;

/** How the document's content looks, on the pages and on the quick sheet alike (slice 26, P3). */
export const DOCUMENT_LOOK_CSS = `

.dpages,.pagedjs_page{--paper:#FFFFFF;--dink:#1B222B;--dink2:#4B5562;--dink3:#7C8794;--dline:#D9DEE4;--dacc:#3346C4;
  color:var(--dink);font:10pt/1.5 var(--font-plex-sans),sans-serif;color-scheme:light}
.dsheet h2{font-size:15pt;font-weight:600;margin:0 0 4mm;color:var(--dink)}
.dh3{font-size:11.5pt;font-weight:600;margin:6mm 0 2.5mm}
.dsheet h4{font-size:10.5pt;font-weight:600;margin:5mm 0 1mm}
.dsheet h5{font-size:9pt;font-weight:600;color:var(--dink2);margin:3mm 0 1mm}
.dsheet p{margin:0 0 3mm;max-width:165mm}
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
.dcover{display:flex;flex-direction:column;justify-content:flex-end;min-height:248mm;padding-bottom:20mm}
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
`;

/**
 * The quick sheet (slice 26, F3, P3): the same content and look at the page's width, one sheet per page break with a
 * faint line every page height, the watermark at the top, the footer fields' text after the last sheet (D8). Scoped to
 * `.dquick`, so it never touches the laid-out pages.
 */
export const QUICK_SHEET_CSS = `
.dquick{display:flex;flex-direction:column;align-items:center;gap:8mm;position:relative}
.dquick .dsheet{box-sizing:border-box;width:210mm;min-height:297mm;padding:${PAGE_MARGIN_MM}mm;background:#fff;
  background-image:repeating-linear-gradient(to bottom,transparent 0,transparent calc(297mm - 1px),#C9D1DA calc(297mm - 1px),#C9D1DA 297mm);
  box-shadow:0 1px 3px rgba(0,0,0,.12),0 10px 30px -18px rgba(0,0,0,.35)}
.dquick .dsec+.dsec{margin-top:6mm}
.dquick .dwm{position:sticky;top:0;align-self:flex-end;z-index:1;font:600 9pt var(--font-plex-sans),sans-serif;color:#B23A0B;margin-bottom:-8mm;padding:2mm 4mm}
.dquick .dfoot{font:7.5pt var(--font-plex-sans),sans-serif;color:#7C8794;text-align:center}
`;

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
