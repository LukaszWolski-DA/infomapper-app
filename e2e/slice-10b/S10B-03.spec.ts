import { expect, test } from "./fixtures";
import { employeesFile, importKeys, openCanvas, place, signInAs, sourceLine, sourceRelationshipId } from "./helpers";
import { clickCard } from "../slice-06b/helpers";

// S10B-03: a missing relationship (item 4). After a re-import without the key, its line (here a loop) is dashed, and
// the table panel still lists it with "· missing".

test("S10B-03: a key the source no longer declares is dashed, and the panel says missing", async ({ page }) => {
  await importKeys(employeesFile({ manager: true }));
  await place("employees", { x: 80, y: 1000 });
  await importKeys(employeesFile({ manager: false }), "hr-2.csv");
  await signInAs(page, "Łukasz");
  await openCanvas(page, undefined, { x: 0, y: -700, zoom: 1 });
  const line = sourceLine(page, await sourceRelationshipId("FK_employees_manager"));
  await expect(line).toHaveClass(/\bmissing\b/);
  expect(await line.locator("path.s").evaluate((p) => getComputedStyle(p).strokeDasharray)).not.toBe("none");
  // the arrow stays whole
  expect(await line.locator("path.ar").evaluate((p) => getComputedStyle(p).strokeDasharray)).toBe("none");

  await clickCard(page, "employees");
  await expect(page.getByTestId("table-relationship").filter({ hasText: "FK_employees_manager" })).toContainText("· missing");
});
