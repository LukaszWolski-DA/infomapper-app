// Every slice 39 test starts from freshly seeded data (the plain seed: no organization holds the InfoCatalog licence,
// C5); a test grants it as test data (`grantCatalogLicence`). Extends `e2e/settle.ts` (fix/write-after-reseed).
// Step 6: `seed` "docs" adds InfoDocumenter's demo (slice 25's `addDocumentsDemoData`: a shared dictionary by Łukasz,
// his private S2T and Anna's private working dictionary in "Retail Co – DWH"), for the drawer's documents (C4).

import { test as base } from "../settle";
import { addDocumentsDemoData } from "../../src/compose/seed";
import { resetDevData } from "../../src/data/local/dev-data";
import { E2E_DB } from "../config";

export const test = base.extend<{ seed: "plain" | "docs"; freshSeed: void }>({
  seed: ["plain", { option: true }],
  freshSeed: [
    async ({ seed }, use) => {
      await resetDevData(E2E_DB, seed === "docs" ? addDocumentsDemoData : undefined);
      await use();
    },
    { auto: true },
  ],
});

export { expect, type Page } from "@playwright/test";
