// Every slice 15a test starts from freshly seeded data with the Sales star (O5): InfoMate's InfoCube licence, InfoCube
// on in "Retail Co – DWH", Fact Sales, Fact Orders, Dim Customer, Dim Product and Dim Date on the canvas "Sales star".
// `test.use({ star: false })` starts from the plain seed every earlier spec uses: no licence, InfoCube off.

import { test as base } from "@playwright/test";
import { addModuleDemoData } from "../../src/compose/seed";
import { resetDevData } from "../../src/data/local/dev-data";
import { E2E_DB } from "../config";

export const test = base.extend<{ star: boolean; freshSeed: void }>({
  viewport: { width: 1536, height: 864 },
  star: [true, { option: true }],
  freshSeed: [
    async ({ star }, use) => {
      await resetDevData(E2E_DB, star ? addModuleDemoData : undefined);
      await use();
    },
    { auto: true },
  ],
});

export { expect, type Page } from "@playwright/test";
