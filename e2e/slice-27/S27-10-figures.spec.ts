// S27-10's reference figures (slice 27, step 3; Q3, F9; no bar): the editor with figures on "Performance test" and the
// demo, on the measurement build in headless Chromium. On demand only (skipped unless MEASURE=1):
//   npm run measure:build && MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-27/S27-10-figures.spec.ts
// The longest preset with Diagrams (the business dictionary: its Diagrams made with the scope's canvases, as New
// document makes it; every mapping shown), and the same document with Diagrams' figures taken out, LOADS loads each after
// one warm-up: the snapshot's answer (bytes), the state's, the tree's and the first layout's time, the pages; then one
// change (the legend off) and what Auto shows after it (pages, or the quick sheet when the last layout took 1,000 ms or
// more, slice 26's rule). The results go to test-results/s27-measure/ (git-ignored); the acceptance doc quotes them.
import fs from "node:fs";
import path from "node:path";
import { STORE_SCHEMA } from "../../src/compose";
import { readDb } from "../../src/data/local/file";
import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { workspaceSnapshotOf, type StoredRows } from "../../src/domain/model/workspace-model";
import { diagramFigures, diagramCanvases } from "../../src/modules/infodocumenter/domain/figures";
import { E2E_DB } from "../config";
import { expect, test, type Page } from "./fixtures";
import { changeDb, createDocumentAs, formUrl, laidOut, RETAIL, SEED_IDS, setWorkspace, signInByName, updateDocumentAs } from "./helpers";

const LOADS = Number(process.env.LOADS ?? 5);
const OUT = path.join("test-results", "s27-measure");
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
};
const spread = (v: number[]) => ({ median: +median(v).toFixed(1), fastest: +Math.min(...v).toFixed(1), slowest: +Math.max(...v).toFixed(1) });

/** In the page before any script: the largest server action answer's decoded size (the snapshot). */
const PROBE = () => {
  const w = window as unknown as { __imBytes: number };
  w.__imBytes = 0;
  const plain = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await plain(input, init);
    if ((init?.method ?? "GET").toUpperCase() === "POST" && new Headers(init?.headers).has("next-action"))
      void res
        .clone()
        .text()
        .then((t) => (w.__imBytes = Math.max(w.__imBytes, new TextEncoder().encode(t).length)));
    return res;
  };
};

async function oneLoad(page: Page, url: string) {
  await page.goto(url);
  const pages = await laidOut(page);
  const span = page.getByTestId("text-build-ms");
  await expect(span).toHaveAttribute("data-ms", /\d/);
  return {
    pages,
    bytes: await page.evaluate(() => (window as unknown as { __imBytes: number }).__imBytes),
    figures: await page.locator('[data-testid="document-host"] [data-testid="figure"]').count(),
    stateMs: Number(await span.getAttribute("data-state-ms")),
    treeMs: Number(await span.getAttribute("data-ms")),
    layoutMs: Number(await page.getByTestId("document-pages").getAttribute("data-layout-ms")),
  };
}

/** The business dictionary with its Diagrams made from the scope's canvases (D9), every mapping shown; its id. */
async function dictionaryWithDiagrams(ws: string, figures: boolean): Promise<string> {
  const { document } = await createDocumentAs(SEED_IDS.userLukasz, "dictionary", ws);
  await updateDocumentAs(SEED_IDS.userLukasz, document.name, { scope: { mappings: "all" } }, ws);
  const db = await readDb(E2E_DB);
  const s = workspaceSnapshotOf(db as unknown as StoredRows, ws, {} as never)!;
  const canvases = diagramCanvases(s.projects, s.projectCanvases, []);
  let n = 0;
  await changeDb((d) => {
    const doc = (d as unknown as { document_definition: { id: string; sections: { type: string; options: Record<string, unknown> }[] }[] }).document_definition.find((x) => x.id === document.id)!;
    doc.sections.find((x) => x.type === "diagrams")!.options.figures = figures
      ? diagramFigures(canvases, () => `00000000-0000-7000-8000-${String(++n).padStart(12, "0")}`, { view: "custom", rows: "keys", lines: { rel: true, map: false, src: false, cube: false }, status: false })
      : [];
  });
  return document.id;
}

async function measure(page: Page, label: string, url: string) {
  test.setTimeout(30 * 60_000);
  await page.addInitScript(PROBE);
  const runs: Awaited<ReturnType<typeof oneLoad>>[] = [];
  for (let i = 0; i <= LOADS; i++) {
    const r = await oneLoad(page, url);
    if (i > 0) runs.push(r);
  }
  // one change after the last load: what Auto shows (slice 26: the quick sheet once a layout took 1,000 ms or more)
  await page.locator('[data-testid="editor-section"][data-section="diagrams"]').click();
  const before = Number(await page.getByTestId("text-build-ms").getAttribute("data-builds"));
  await page.getByTestId("check-diagrams-legend").uncheck();
  await expect(page.getByTestId("text-build-ms")).toHaveAttribute("data-builds", String(before + 1));
  await expect(page.getByTestId("document-pages")).toHaveAttribute("data-state", /^(done|quick)$/, { timeout: 120_000 });
  const after = await page.getByTestId("document-pages").getAttribute("data-shown");
  const result = {
    label,
    browser: page.context().browser()?.version(),
    pages: runs[0]!.pages,
    figures: runs[0]!.figures,
    snapshotDecodedBytes: runs[0]!.bytes,
    stateMs: spread(runs.map((r) => r.stateMs)),
    treeMs: spread(runs.map((r) => r.treeMs)),
    layoutMs: spread(runs.map((r) => r.layoutMs)),
    shownAfterAChange: after,
  };
  console.log(`S27-10 ${label}:`, JSON.stringify(result));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${label}.json`), JSON.stringify(result, null, 2));
}

test.describe("Performance test", () => {
  for (const figures of [true, false])
    test(`the dictionary preset, Diagrams ${figures ? "with" : "without"} its figures`, async ({ page }) => {
      test.skip(!process.env.MEASURE, "MEASURE=1 only");
      await seedLargeData(E2E_DB, STORE_SCHEMA);
      await setWorkspace(LARGE_IDS.workspace, { infodoc: true });
      const id = await dictionaryWithDiagrams(LARGE_IDS.workspace, figures);
      await signInByName(page, "Łukasz");
      await measure(page, `pt-dictionary-${figures ? "figures" : "none"}`, formUrl(id, LARGE_IDS.workspace));
    });
});

test.describe("demo", () => {
  test.use({ seed: "full" });
  for (const figures of [true, false])
    test(`the dictionary preset, Diagrams ${figures ? "with" : "without"} its figures`, async ({ page }) => {
      test.skip(!process.env.MEASURE, "MEASURE=1 only");
      const id = await dictionaryWithDiagrams(RETAIL, figures);
      await signInByName(page, "Łukasz");
      await measure(page, `demo-dictionary-${figures ? "figures" : "none"}`, formUrl(id, RETAIL));
    });
});
