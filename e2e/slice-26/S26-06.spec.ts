// S26-06 (slice 26, PRD section 2): on the demo, Requirements and coverage, Traceability, Data quality rules and
// InfoCube's Bus matrix; the bus matrix only while InfoCube is on (skipped, and said so, while it is off).

import { writeInfoCubeOff } from "../slice-22/helpers";
import { expect, test } from "./fixtures";
import { changeDb, DEMO_DOCUMENT_NAMES, laidOut, sectionText, setSections, signInAs, storedDocument, viewUrl } from "./helpers";

test.use({ seed: "full" });

const SHARED = DEMO_DOCUMENT_NAMES.shared;

async function open(page: import("@playwright/test").Page) {
  await signInAs(page, "Łukasz");
  await page.goto(viewUrl((await storedDocument(SHARED))!.id));
  await laidOut(page);
}

test("S26-06: requirements with coverage, traceability, data quality rules and the bus matrix", async ({ page }) => {
  await setSections(SHARED, [{ type: "reqs" }, { type: "trace" }, { type: "dq" }, { type: "cube.bus" }]);
  // the document shows drafts too
  await changeDb((db) => {
    (db as unknown as { document_definition: { name: string; scope: { mappings: string } }[] }).document_definition.find((d) => d.name === SHARED)!.scope.mappings = "all";
  });
  await open(page);
  const host = page.getByTestId("document-host");

  const reqs = await sectionText(page, "Requirements and coverage");
  for (const part of ["REQ-102", "Contact data for every active customer", "Kind:", "Data requirement", "Status:", "Agreed", "Priority:", "Must", "3/3", "REQ-101 Single view of the customer"]) {
    expect(reqs, part).toContain(part);
  }
  await expect(host.locator(".dreq .dbar").first()).toBeVisible();

  const trace = await sectionText(page, "Traceability");
  for (const part of ["REQ-104 Order total equals the sum of its lines", "Sales Order.total_amount", "order_header.ord_total", "Fact Orders.total_amount", "Feeds", "Covered"]) {
    expect(trace, part).toContain(part);
  }

  const dq = await sectionText(page, "Data quality rules");
  for (const part of ["REQ-103", "E-mail is unique per customer", "Warn", "Data steward", "Customer.email", "COUNT(DISTINCT customer_id) per lower(email) = 1"]) {
    expect(dq, part).toContain(part);
  }

  const bus = await sectionText(page, "Bus matrix");
  for (const part of ["Fact", "Fact Sales", "Fact Orders", "Dim Customer", "Dim Date", "●"]) expect(bus, part).toContain(part);
  await expect(host.locator("table.dt.bus .dvert").first()).toBeVisible();
});

test("S26-06: the bus matrix is skipped while InfoCube is off, and the page says so", async ({ page }) => {
  await setSections(SHARED, [{ type: "reqs" }, { type: "cube.bus" }]);
  await writeInfoCubeOff();
  await open(page);
  const host = page.getByTestId("document-host");
  await expect(host.locator(".dtoc li")).toHaveText([/^1Requirements and coverage/]);
  await expect(host.getByTestId("document-skipped")).toHaveText("Skipped while InfoCube is off: Bus matrix.");
});
