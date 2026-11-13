// Slice 25, step 4's reference figure (Q-P1: no bar; Łukasz decides after seeing it): laying out a full data dictionary of
// "Performance test" (41 entities, about 800 attributes) in A4 pages with Paged.js, in headless Chromium, on the measurement build
// (`npm run measure:build`, then `MEASURE=1 MEASURE_BUILD=production npx playwright test e2e/slice-25/S25-layout.spec.ts`;
// without MEASURE_BUILD it runs on the e2e dev server). Only with MEASURE=1: the normal run skips it.
// One warm-up load, then LOADS loads (default 5): per load the time from the navigation's start to "{n} pages" (the
// page's own load, the server's tree and HTML, Paged.js), and Paged.js's part alone (the page's `data-layout-ms`, from
// starting Paged.js to its last page); median, fastest, slowest, and the page count. Printed and saved in
// test-results/S25-layout.json.

import fs from "node:fs";
import path from "node:path";
import { STORE_SCHEMA } from "../../src/compose";
import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { E2E_DB } from "../config";
import { expect, test } from "./fixtures";
import { createDocumentAs, laidOut, SEED_IDS, setWorkspace, signInAs, updateDocumentAs, viewUrl } from "./helpers";

const LOADS = Number(process.env.LOADS ?? 5);

test("S25-layout: a full data dictionary of Performance test laid out in pages (reference figure)", async ({ page }) => {
  test.skip(!process.env.MEASURE, "MEASURE=1 only: a reference figure, not a check");
  test.setTimeout(15 * 60_000);
  // the composed schema: the file holds InfoDocumenter's documents
  await seedLargeData(E2E_DB, STORE_SCHEMA);
  await setWorkspace(LARGE_IDS.workspace, { infodoc: true });
  const { document } = await createDocumentAs(SEED_IDS.userLukasz, "dictionary", LARGE_IDS.workspace);
  await updateDocumentAs(
    SEED_IDS.userLukasz,
    document.name,
    {
      scope: { mappings: "all" },
      section: {
        id: document.sections.find((s) => s.type === "dict")!.id,
        options: {
          entity: ["stereotype", "definition", "coverage", "requirements", "relationships"],
          columns: ["attribute", "type", "keys", "nullable", "pii", "definition", "mappedFrom", "calculation", "requirements"],
        },
      },
    },
    LARGE_IDS.workspace,
  );
  await signInAs(page, "Łukasz");
  const url = viewUrl(document.id, LARGE_IDS.workspace);
  const rounds: { total: number; paged: number; pages: number }[] = [];
  for (let i = 0; i <= LOADS; i++) {
    const started = Date.now();
    await page.goto(url);
    const pages = await laidOut(page);
    const total = Date.now() - started;
    const paged = Number(await page.getByTestId("document-pages").getAttribute("data-layout-ms"));
    if (i > 0) rounds.push({ total, paged, pages });
  }
  const stat = (k: "total" | "paged") => {
    const v = rounds.map((r) => r[k]).sort((a, b) => a - b);
    return { median: v[Math.floor(v.length / 2)], fastest: v[0], slowest: v.at(-1) };
  };
  const result = { loads: rounds.length, pages: rounds[0]!.pages, toPages: stat("total"), pagedJs: stat("paged"), browser: page.context().browser()?.version() };
  console.log("S25-layout:", JSON.stringify(result));
  fs.writeFileSync(path.join("test-results", "S25-layout.json"), JSON.stringify(result, null, 2));
  expect(rounds.every((r) => r.pages === rounds[0]!.pages)).toBe(true);
});
