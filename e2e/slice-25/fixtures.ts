// Slice 25's fixtures: the e2e data file reseeded before every test. `seed`:
// - "docs" (the default): the plain seed and InfoDocumenter's demo (`addDocumentsDemoData`: InfoMate's licence,
//   InfoDocumenter on in "Retail Co – DWH", three live documents), no star, so InfoCube is off;
// - "plain": slice 0's seed (no licence, InfoDocumenter off);
// - "full": everything the seed writes (`addSeedDemoData`: the star with its derivations, types and checks, then the
//   documents), for InfoCube's Dimensional model (S25-06).

import { test as base } from "@playwright/test";
import { addDocumentsDemoData, addSeedDemoData } from "../../src/compose/seed";
import { resetDevData } from "../../src/data/local/dev-data";
import { E2E_DB } from "../config";

export const test = base.extend<{ seed: "docs" | "plain" | "full"; freshSeed: void }>({
  seed: ["docs", { option: true }],
  viewport: { width: 1536, height: 864 },
  freshSeed: [
    async ({ seed }, use) => {
      await resetDevData(E2E_DB, seed === "plain" ? undefined : seed === "full" ? addSeedDemoData : addDocumentsDemoData);
      await use();
    },
    { auto: true },
  ],
});

export { expect, type Page } from "@playwright/test";
