// S27-07 (slice 27, PRD section 6, Q2 as Łukasz answered): the text on a figure is in IBM Plex, in the pages and in a
// printed PDF. A figure is an `<img>` of an SVG, which sees none of the page's fonts, so each figure's SVG embeds IBM
// Plex's unmodified files (`src/app/fonts/ibm-plex/`), only the faces it uses; the PDF names no font but IBM Plex (no
// system fallback) and keeps the text as text (ToUnicode: searchable).

import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "./fixtures";
import { canvasId, DEMO_DOCUMENT_NAMES, figureImages, figuresOnly, laidOut, newFigure, signInAs, storedDocument, svgOf, viewUrl } from "./helpers";

const DOC = DEMO_DOCUMENT_NAMES.shared;
const FILES: Record<string, string> = {
  "IBM Plex Sans 400": "IBMPlexSans-Regular.woff2",
  "IBM Plex Sans 500": "IBMPlexSans-Medium.woff2",
  "IBM Plex Sans 600": "IBMPlexSans-SemiBold.woff2",
  "IBM Plex Mono 400": "IBMPlexMono-Regular.woff2",
  "IBM Plex Mono 500": "IBMPlexMono-Medium.woff2",
};
const base64Of = (file: string) => readFileSync(path.join("src/app/fonts/ibm-plex", file)).toString("base64");

test("S27-07: a figure's text is in IBM Plex's unmodified files, in the pages and in a printed PDF, and stays text", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "page.pdf() is Chromium's");
  await figuresOnly(DOC, [newFigure("f1", await canvasId("Customer & orders"))]);
  await signInAs(page, "Łukasz");
  await page.goto(viewUrl((await storedDocument(DOC))!.id));
  await laidOut(page);
  const [img] = await figureImages(page);
  expect(img!.width).toBeGreaterThan(0);

  // the SVG embeds each face it uses, IBM's files byte for byte (no subset), and asks for them by name
  const svg = await svgOf(page, img!.src);
  const faces = [...svg.matchAll(/@font-face\{font-family:'([^']+)';font-weight:(\d+);src:url\(data:font\/woff2;base64,([^)]+)\) format\('woff2'\)\}/g)];
  const named = faces.map((m) => `${m[1]} ${m[2]}`);
  // the canvas has entities and source tables: both families, the regular and the semibold names
  expect(named).toEqual(expect.arrayContaining(["IBM Plex Sans 400", "IBM Plex Sans 600", "IBM Plex Mono 400"]));
  for (const m of faces) expect(m[3], `${m[1]} ${m[2]}`).toBe(base64Of(FILES[`${m[1]} ${m[2]}`]!));
  expect(svg).toContain("text{font-family:'IBM Plex Sans',sans-serif");

  // printed: every font the PDF names is IBM Plex, and its text has ToUnicode maps (searchable)
  const pdf = (await page.pdf({ preferCSSPageSize: true, printBackground: true })).toString("latin1");
  const fonts = [...new Set([...pdf.matchAll(/\/BaseFont\s*\/([A-Z]{6}\+)?([\w-]+)/g)].map((m) => m[2]!))];
  expect(fonts.length).toBeGreaterThan(0);
  expect(fonts.filter((f) => !/^IBMPlex/.test(f)), fonts.join(", ")).toEqual([]);
  expect(fonts.some((f) => /^IBMPlexMono/.test(f))).toBe(true);
  expect(pdf).toContain("/ToUnicode");
});
