// S25-05 (slice 25, PRD section 2, D9): the source-to-target mapping prints the chosen columns, the rule under the row;
// grouped by target entity and by source system; "Approved only" hides drafts and reviews; the attributes with no mapping
// are listed when chosen. Łukasz's private S2T of the demo (scope Order management, approved and in review).

import { expect, test, type Page } from "./fixtures";
import { DEMO_DOCUMENT_NAMES, formUrl, keepOnly, laidOut, sectionOf, signInAs, storedDocument, unnumbered, viewUrl } from "./helpers";

const S2T = DEMO_DOCUMENT_NAMES.s2t;

/** The tables' header cells, the group headings and the status pills on the laid-out pages. */
const read = (page: Page) =>
  page.evaluate(() => {
    const host = document.querySelector('[data-testid="document-host"]')!;
    return {
      head: [...(host.querySelector("table.dt thead tr")?.querySelectorAll("th") ?? [])].map((t) => t.textContent),
      groups: [...new Set([...host.querySelectorAll("h3.dh3")].map((h) => h.textContent))],
      statuses: [...new Set([...host.querySelectorAll(".dst")].map((s) => s.textContent))],
      below: [...host.querySelectorAll("tr.ddr td")].map((t) => t.textContent),
      notMapped: [...host.querySelectorAll("td .dwarn")].filter((x) => x.textContent === "Not mapped").length,
      text: host.textContent ?? "",
    };
  });

async function openView(page: Page) {
  // slice 26 (D2): the preset has more sections; this spec reads the S2T alone
  await keepOnly(S2T, ["s2t"]);
  await unnumbered(S2T);
  await page.goto(viewUrl((await storedDocument(S2T))!.id));
  await laidOut(page);
  return read(page);
}

/** Changes a choice in the form and waits until it is stored. */
async function choose(page: Page, seg: string, label: string, stored: (d: NonNullable<Awaited<ReturnType<typeof storedDocument>>>) => unknown, value: unknown) {
  await page.goto(formUrl((await storedDocument(S2T))!.id));
  // slice 26: a section's options are in the editor's right panel once the section is selected
  if (seg === "seg-s2t-group") await page.locator('[data-testid="editor-section"][data-section="s2t"]').click();
  await page.getByTestId(seg).getByRole("button", { name: label, exact: true }).click();
  await expect.poll(async () => stored((await storedDocument(S2T))!)).toEqual(value);
}

test("S25-05: the chosen columns, the rule under the row, by target entity with the attributes that have no mapping", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const v = await openView(page);
  expect(v.head).toEqual(["Target", "Target type", "System", "Source column", "Source type", "Status", "Type check"]);
  expect(v.groups[0]).toBe("Customer");
  expect(v.groups).toContain("Sales Order");
  // one long text chosen: under the row, unlabelled
  expect(v.below.length).toBeGreaterThan(0);
  expect(v.below.every((b) => b === "Direct copy" || b?.startsWith("Transformation: "))).toBe(true);
  expect(v.notMapped).toBeGreaterThan(0);
  expect(v.statuses.sort()).toEqual(["Approved", "In review"]);
  expect(v.statuses).not.toContain("Draft");
});

test("S25-05: Approved only hides drafts and reviews; by source system the systems are the groups", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await choose(page, "seg-mappings", "Approved only", (d) => d.scope.mappings, "approved");
  const approved = await openView(page);
  expect(approved.statuses).toEqual(["Approved"]);

  await choose(page, "seg-s2t-group", "By source system", (d) => (sectionOf(d, "s2t").options as { group: string }).group, "system");
  const bySystem = await openView(page);
  expect(bySystem.groups.length).toBeGreaterThan(0);
  expect(bySystem.groups).toEqual([...bySystem.groups].sort((a, b) => a!.localeCompare(b!)));
  expect(bySystem.groups).not.toContain("Customer");
  // the attributes with no mapping belong to the grouping by entity only (D9)
  expect(bySystem.notMapped).toBe(0);
});
