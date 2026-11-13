// S26-10's reference figures (slice 26, steps 2 and 3; D7): the editor on "Performance test" and the demo, on the
// measurement build in headless Chromium. On demand only (skipped unless MEASURE=1):
//   npm run measure:build && MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-26/S26-10-figures.spec.ts
// Per document, LOADS loads of the editor after one warm-up:
// - the snapshot's answer (`documentSnapshotAction`): its bytes as received and decoded, and every e-mail address-like
//   text in it (D7: none);
// - the document state's build (`data-state-ms`), the tree's (`data-ms`) and the first layout (`data-layout-ms`).
// The results go to test-results/s26-measure/ (git-ignored); the acceptance doc quotes them.
import fs from "node:fs";
import path from "node:path";
import { STORE_SCHEMA } from "../../src/compose";
import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { E2E_DB } from "../config";
import { expect, test, type Page } from "./fixtures";
import { createDocumentAs, DEMO_DOCUMENT_NAMES, formUrl, laidOut, RETAIL, SEED_IDS, setWorkspace, signInByName, storedDocument, updateDocumentAs } from "./helpers";

const LOADS = Number(process.env.LOADS ?? 5);
const OUT = path.join("test-results", "s26-measure");
const ALL_DICT = {
  entity: ["stereotype", "definition", "coverage", "requirements", "relationships"],
  columns: ["attribute", "type", "keys", "nullable", "pii", "definition", "mappedFrom", "calculation", "requirements"],
};
const ALL_S2T = { columns: ["target", "targetType", "system", "sourceColumn", "sourceType", "rule", "status", "typeCheck", "note", "requirements"], group: "entity", unmapped: true };

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
};
const spread = (v: number[]) => ({ median: +median(v).toFixed(1), fastest: +Math.min(...v).toFixed(1), slowest: +Math.max(...v).toFixed(1) });

/** In the page before any script: every server action's answer, its decoded size and the e-mail-like texts in it. */
const PROBE = () => {
  const w = window as unknown as { __imActions: { bytes: number; emails: string[] }[] };
  w.__imActions = [];
  const plain = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await plain(input, init);
    const headers = new Headers(init?.headers);
    if ((init?.method ?? "GET").toUpperCase() === "POST" && headers.has("next-action")) {
      void res
        .clone()
        .text()
        .then((text) => w.__imActions.push({ bytes: new TextEncoder().encode(text).length, emails: [...new Set(text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [])] }));
    }
    return res;
  };
};

async function oneLoad(page: Page, url: string) {
  // the encoded size: the network's count of the largest action answer
  let encoded = 0;
  const onResponse = async (r: import("@playwright/test").Response) => {
    const req = r.request();
    if (req.method() !== "POST" || !(await req.headerValue("next-action").catch(() => null))) return;
    try {
      encoded = Math.max(encoded, (await req.sizes()).responseBodySize);
    } catch {
      // the page moved on
    }
  };
  page.on("response", onResponse);
  await page.goto(url);
  const pages = await laidOut(page);
  const span = page.getByTestId("text-build-ms");
  await expect(span).toHaveAttribute("data-ms", /\d/);
  page.off("response", onResponse);
  const actions = await page.evaluate(() => (window as unknown as { __imActions: { bytes: number; emails: string[] }[] }).__imActions);
  const snapshot = actions.reduce((a, b) => (b.bytes > a.bytes ? b : a), { bytes: 0, emails: [] as string[] });
  return {
    pages,
    snapshot: { encoded, decoded: snapshot.bytes, emails: snapshot.emails },
    stateMs: Number(await span.getAttribute("data-state-ms")),
    treeMs: Number(await span.getAttribute("data-ms")),
    layoutMs: Number(await page.getByTestId("document-pages").getAttribute("data-layout-ms")),
  };
}

async function measure(page: Page, label: string, url: string) {
  test.setTimeout(20 * 60_000);
  await page.addInitScript(PROBE);
  const runs: Awaited<ReturnType<typeof oneLoad>>[] = [];
  for (let i = 0; i <= LOADS; i++) {
    const r = await oneLoad(page, url);
    if (i > 0) runs.push(r);
  }
  const result = {
    label,
    browser: page.context().browser()?.version(),
    pages: runs[0]!.pages,
    snapshotEncodedBytes: runs[0]!.snapshot.encoded,
    snapshotDecodedBytes: runs[0]!.snapshot.decoded,
    emails: runs[0]!.snapshot.emails,
    stateMs: spread(runs.map((r) => r.stateMs)),
    treeMs: spread(runs.map((r) => r.treeMs)),
    layoutMs: spread(runs.map((r) => r.layoutMs)),
  };
  console.log(`S26-D7 ${label}:`, JSON.stringify(result));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `d7-${label}.json`), JSON.stringify(result, null, 2));
}

test.describe("Performance test", () => {
  test("dictionary, every field and column", async ({ page }) => {
    test.skip(!process.env.MEASURE, "MEASURE=1 only");
    await seedLargeData(E2E_DB, STORE_SCHEMA);
    await setWorkspace(LARGE_IDS.workspace, { infodoc: true });
    const { document } = await createDocumentAs(SEED_IDS.userLukasz, "dictionary", LARGE_IDS.workspace);
    await updateDocumentAs(SEED_IDS.userLukasz, document.name, { scope: { mappings: "all" }, section: { id: document.sections.find((s) => s.type === "dict")!.id, options: ALL_DICT } }, LARGE_IDS.workspace);
    await signInByName(page, "Łukasz");
    await measure(page, "pt-dictionary", formUrl(document.id, LARGE_IDS.workspace));
  });
  test("source-to-target, every column, unmapped too", async ({ page }) => {
    test.skip(!process.env.MEASURE, "MEASURE=1 only");
    await seedLargeData(E2E_DB, STORE_SCHEMA);
    await setWorkspace(LARGE_IDS.workspace, { infodoc: true });
    const { document } = await createDocumentAs(SEED_IDS.userLukasz, "s2t", LARGE_IDS.workspace);
    await updateDocumentAs(SEED_IDS.userLukasz, document.name, { scope: { mappings: "all" }, section: { id: document.sections.find((s) => s.type === "s2t")!.id, options: ALL_S2T } }, LARGE_IDS.workspace);
    await signInByName(page, "Łukasz");
    await measure(page, "pt-s2t", formUrl(document.id, LARGE_IDS.workspace));
  });
});

test.describe("Performance test, the longest preset (step 3)", () => {
  // the prototype's longest preset this slice has: the data dictionary for the business (7 sections), every mapping shown
  test("dictionary preset", async ({ page }) => {
    test.skip(!process.env.MEASURE, "MEASURE=1 only");
    await seedLargeData(E2E_DB, STORE_SCHEMA);
    await setWorkspace(LARGE_IDS.workspace, { infodoc: true });
    const { document } = await createDocumentAs(SEED_IDS.userLukasz, "dictionary", LARGE_IDS.workspace);
    await updateDocumentAs(SEED_IDS.userLukasz, document.name, { scope: { mappings: "all" } }, LARGE_IDS.workspace);
    await signInByName(page, "Łukasz");
    await measure(page, "pt-preset-dictionary", formUrl(document.id, LARGE_IDS.workspace));
  });
  test("source-to-target preset", async ({ page }) => {
    test.skip(!process.env.MEASURE, "MEASURE=1 only");
    await seedLargeData(E2E_DB, STORE_SCHEMA);
    await setWorkspace(LARGE_IDS.workspace, { infodoc: true });
    const { document } = await createDocumentAs(SEED_IDS.userLukasz, "s2t", LARGE_IDS.workspace);
    await updateDocumentAs(SEED_IDS.userLukasz, document.name, { scope: { mappings: "all" } }, LARGE_IDS.workspace);
    await signInByName(page, "Łukasz");
    await measure(page, "pt-preset-s2t", formUrl(document.id, LARGE_IDS.workspace));
  });
});

test.describe("demo", () => {
  test.use({ seed: "full" });
  for (const [key, who] of [
    ["shared", "Łukasz"],
    ["s2t", "Łukasz"],
    ["anna", "Anna Nowak"],
  ] as const) {
    test(`demo ${key}`, async ({ page }) => {
      test.skip(!process.env.MEASURE, "MEASURE=1 only");
      const doc = (await storedDocument(DEMO_DOCUMENT_NAMES[key]))!;
      await signInByName(page, who);
      await measure(page, `demo-${key}`, formUrl(doc.id, RETAIL));
    });
  }
});
