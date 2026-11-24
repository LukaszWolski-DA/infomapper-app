// Slice 35's fixtures are slice 25's (the e2e data file reseeded before every test; `seed` "docs", "plain" or "full")
// in a 1440 x 900 window. The specs use "full" (`test.use`): everything the seed writes (`addSeedDemoData`), so "Retail
// Co – DWH" has the star, the documents and the demo's baseline "Stage 1 sign-off".

import { test as base } from "../slice-25/fixtures";

export const test = base.extend({ viewport: { width: 1440, height: 900 } });

export { expect, type Page } from "@playwright/test";
