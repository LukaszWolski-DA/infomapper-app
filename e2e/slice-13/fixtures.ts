// Every slice 13 test starts from freshly seeded data: an automatic fixture resets the e2e data file before each
// test. The undo history lives in the server's memory and leaves out steps whose change group is no longer in the file.

import { test as base } from "@playwright/test";
import { resetDevData } from "../../src/data/local/dev-data";
import { E2E_DB } from "../config";

export const test = base.extend<{ freshSeed: void }>({
  freshSeed: [
    async ({}, use) => {
      await resetDevData(E2E_DB);
      await use();
    },
    { auto: true },
  ],
});

export { expect, type Page } from "@playwright/test";
