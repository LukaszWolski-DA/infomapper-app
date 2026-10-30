import { expect, test } from "./fixtures";
import { employeesFile, importKeys, openCanvas, place, signInAs, sourceLine, sourceRelationshipId, sourceShape } from "./helpers";

// S10B-02: a key to itself (item 3, D-61's loop). employees.manager_id → employees is a loop from the card's right edge
// (the table with the key) to its top edge (the referenced table, with the arrow pointing down into the card). A second
// key to itself nests outside it.

const VIEW = { x: 0, y: -700, zoom: 1 };

test("S10B-02: a key to itself is a loop from the right edge to the top edge, a second one nests outside", async ({ page }) => {
  await importKeys(employeesFile({ manager: true }));
  await place("employees", { x: 80, y: 1000 });
  await signInAs(page, "Łukasz");
  await openCanvas(page, undefined, VIEW);
  const manager = await sourceRelationshipId("FK_employees_manager");
  await expect(sourceLine(page, manager)).toHaveCount(1);
  const a = await sourceShape(page, manager, "employees", "employees");
  // from the right edge, to the top edge near the corner
  expect(Math.abs(a.start.x - a.from.right)).toBeLessThan(2);
  expect(a.start.y).toBeGreaterThan(a.from.top);
  expect(Math.abs(a.end.y - a.from.top)).toBeLessThan(2);
  expect(a.end.x).toBeLessThan(a.from.right);
  expect(a.end.x).toBeGreaterThan(a.from.left);
  // the arrow at the top end, its base above the card (it points down into it)
  expect(Math.abs(a.tip.x - a.end.x)).toBeLessThan(1);
  expect(Math.abs(a.tip.y - a.end.y)).toBeLessThan(1);
  expect(a.base.y).toBeLessThan(a.tip.y);

  // a second key to itself nests outside the first: both ends 16 px further from the corner
  await importKeys(employeesFile({ manager: true, mentor: true }), "hr-2.csv");
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  const mentor = await sourceRelationshipId("FK_employees_mentor");
  const first = await sourceShape(page, manager, "employees", "employees");
  const second = await sourceShape(page, mentor, "employees", "employees");
  expect(Math.abs(second.start.y - first.start.y - 16)).toBeLessThan(1.5);
  expect(Math.abs(first.end.x - second.end.x - 16)).toBeLessThan(1.5);
});
