// S18-01 (slice 18, Q1, Q2): the data. A file written before slice 18 (format 13: no calculation columns, no
// `attribute_input`, no lookup columns on InfoCube's rows) is read and upgraded to format 14 with nothing else changed,
// and its pages work; a calculation and a lookup survive a save, a reload, and an undo and a redo.

import { readFile, writeFile } from "node:fs/promises";
import { DEV_DB_FORMAT } from "../../src/data/local/schema";
import { E2E_DB } from "../config";
import { expect, test } from "./fixtures";
import {
  addAttributeAs,
  attributeNamed,
  calcSection,
  cubeMappingId,
  cubeMappingRow,
  expectAttributePanelAt,
  expectCubePanelAt,
  expectToast,
  hydrated,
  inputsOf,
  openAttribute,
  openCubeMapping,
  openStar,
  pickInputs,
  signInAs,
  undoButton,
} from "./helpers";
import { redoButton } from "../slice-12a/helpers";

const without = (row: Record<string, unknown>, columns: readonly string[]) => Object.fromEntries(Object.entries(row).filter(([k]) => !columns.includes(k)));

test("S18-01: a format-13 file is upgraded to 14 on its first read, rows and counts unchanged, and its pages open", async ({ page }) => {
  const db = JSON.parse(await readFile(E2E_DB, "utf8")) as Record<string, unknown> & { attribute: Record<string, unknown>[]; cube_mapping: Record<string, unknown>[] };
  // the file as slice 17 wrote it: the star without slice 18's demo (no calculation, no lookup)
  const old: Record<string, unknown> = {
    ...db,
    format: 13,
    attribute: db.attribute.map((a) => without(a, ["is_calculated", "calc_rule"])),
    cube_mapping: db.cube_mapping.map((m) => ({ ...without(m, ["lookup_relationship_id", "lookup_default"]), kind: m.kind === "lookup" ? "direct" : m.kind })),
  };
  delete old.attribute_input;
  await writeFile(E2E_DB, JSON.stringify(old), "utf8");

  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  const upgraded = JSON.parse(await readFile(E2E_DB, "utf8")) as typeof db & { attribute_input: unknown[] };
  expect(upgraded.format).toBe(DEV_DB_FORMAT);
  expect(upgraded.attribute.length).toBe(db.attribute.length);
  expect(upgraded.attribute.every((a) => a.is_calculated === false && a.calc_rule === null)).toBe(true);
  expect(upgraded.attribute_input).toEqual([]);
  // InfoCube's rows are not part of the format (AD-33): left as they were, read with the two columns null
  expect(upgraded.cube_mapping.some((m) => "lookup_relationship_id" in m)).toBe(false);
  const country = cubeMappingId("cust.country_name");
  const panel = await openCubeMapping(page, country);
  await expect(panel.getByTestId("seg-cube-kind").getByRole("button", { name: "Direct copy", exact: true })).toHaveAttribute("aria-pressed", "true");
  // and they save as before: a note on an old row
  const note = panel.getByTestId("input-cube-note");
  await note.fill("Saved on a row written before slice 18.");
  await note.blur();
  await expect.poll(async () => (await cubeMappingRow(country))?.note).toBe("Saved on a row written before slice 18.");
  expect(await cubeMappingRow(country)).toMatchObject({ lookup_relationship_id: null, lookup_default: null });
});

test("S18-01: a calculation and a lookup survive a reload, an undo and a redo", async ({ page }) => {
  const id = await addAttributeAs("Order Line", "line_total");
  await signInAs(page, "Łukasz");
  await openStar(page);
  await openAttribute(page, "Order Line", "line_total");
  await calcSection(page).getByTestId("button-calculate").click();
  await pickInputs(page, ["quantity", "unit_price"]);
  await expect.poll(() => inputsOf(id)).toEqual(["quantity", "unit_price"]);
  await page.reload();
  await hydrated(page);
  await openAttribute(page, "Order Line", "line_total");
  await expect(calcSection(page).getByTestId("item-calculation-input")).toHaveCount(2);
  await expectAttributePanelAt(page, id);
  await undoButton(page).click();
  await expectToast(page, "Undone: Calculate attribute");
  await expect.poll(async () => (await attributeNamed("Order Line", "line_total")).is_calculated).toBe(false);
  await redoButton(page).click();
  await expectToast(page, "Redone: Calculate attribute");
  await expect.poll(() => inputsOf(id)).toEqual(["quantity", "unit_price"]);

  const country = cubeMappingId("cust.country_name");
  const panel = await openCubeMapping(page, country);
  const noMatch = panel.getByTestId("input-cube-lookup-default");
  await noMatch.fill("Unbekannt");
  await noMatch.blur();
  await expect.poll(async () => (await cubeMappingRow(country))?.lookup_default).toBe("Unbekannt");
  await page.reload();
  await hydrated(page);
  await openCubeMapping(page, country);
  await expect(page.getByTestId("input-cube-lookup-default")).toHaveValue("Unbekannt");
  await expectCubePanelAt(page, country);
  await undoButton(page).click();
  await expectToast(page, "Undone: Change dimensional mapping");
  await expect.poll(async () => (await cubeMappingRow(country))?.lookup_default).toBe("Unknown");
  await redoButton(page).click();
  await expectToast(page, "Redone: Change dimensional mapping");
  await expect.poll(async () => (await cubeMappingRow(country))?.lookup_default).toBe("Unbekannt");
});
