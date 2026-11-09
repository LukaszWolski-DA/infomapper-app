// Every slice 20 test starts from freshly seeded data with everything the seed writes (`addFullDemoData`): the Sales
// star, slice 18's derivations, slice 19's types and slice 20's checks demo (the demo model's keys as copies,
// Customer.last_order_id, Product.country_code, Product.Product_Name, Sales Order.total_amount calculated, Customer
// Address.country_code no foreign key). Earlier slices' fixtures do not add slice 20's demo (answer 11).

import { test as base } from "@playwright/test";
import { addFullDemoData } from "../../src/compose/seed";
import { resetDevData } from "../../src/data/local/dev-data";
import { E2E_DB } from "../config";

export const test = base.extend<{ freshSeed: void }>({
  viewport: { width: 1536, height: 864 },
  freshSeed: [
    async ({}, use) => {
      await resetDevData(E2E_DB, addFullDemoData);
      await use();
    },
    { auto: true },
  ],
});

export { expect, type Page } from "@playwright/test";
