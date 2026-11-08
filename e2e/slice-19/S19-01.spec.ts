// S19-01 (data, F1; Q1, Q2): the e2e file's InfoCube rows written back in slice 18's shape (`scd_type`, no new columns)
// read with the same values: the Cube tab's SCD labels, the chips, the bus matrix; a write over them stores the new shape.
// Every new field survives a save, a reload, undo and redo.

import { readDb } from "../../src/data/local/file";
import { E2E_DB } from "../config";
import { expect, test } from "./fixtures";
import {
  cubeItem,
  cubeRow,
  factTypeSeg,
  historySeg,
  hydrated,
  kindSeg,
  openEntity,
  openStar,
  periodField,
  redoButton,
  roleOf,
  segment,
  signInAs,
  typeEntity,
  undoButton,
  writeOlderCubeRows,
} from "./helpers";

test("S19-01: an older file's rows read as before; a write stores the new shape", async ({ page }) => {
  await writeOlderCubeRows();
  await signInAs(page, "Łukasz");
  await openStar(page);
  await page.getByTestId("tab-cube").click();
  // the snapshot was written back as SCD 1, the base and the kinds were not in slice 18's shape
  await expect(cubeItem(page, "Dim Customer")).toContainText("SCD 2");
  await expect(cubeItem(page, "Dim Date")).toContainText("SCD 0");
  await expect(cubeItem(page, "Dim Product")).toContainText("SCD 1");
  await expect(cubeItem(page, "Fact Orders")).toContainText("grain set");
  await expect(roleOf(page, "Fact Sales")).toHaveText("Fact");
  // Dim Category's relationship "groups" is no file shape: it stays an outrigger
  await expect(roleOf(page, "Dim Category")).toHaveText("Dimension · Outrigger");
  await expect(roleOf(page, "Dim Order Flags")).toHaveText("Dimension");

  await openEntity(page, "Dim Date");
  await segment(historySeg(page), "2 · history").click();
  await expect.poll(async () => (await cubeRow(typeEntity("date")))?.history).toBe("history");
  const stored = ((await readDb(E2E_DB)) as unknown as { cube_entity: Record<string, unknown>[] }).cube_entity;
  expect(stored.some((r) => "scd_type" in r)).toBe(false);
  expect(stored.filter((r) => r.role === "dimension").every((r) => r.dim_kind && r.history)).toBe(true);
});

test("S19-01: every new field survives a save, a reload, undo and redo", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  const row = (key: Parameters<typeof typeEntity>[0]) => cubeRow(typeEntity(key));

  // a fact's type and factless, Fact Sales
  await openEntity(page, "Fact Sales");
  await segment(factTypeSeg(page), "Periodic").click();
  await expect.poll(async () => (await row("sales"))?.fact_type).toBe("periodic");
  await page.getByTestId("field-cube-factless").getByRole("button", { name: "Factless fact" }).click();
  await expect.poll(async () => (await row("sales"))?.is_factless).toBe(true);
  await page.reload();
  await hydrated(page);
  await openEntity(page, "Fact Sales");
  await expect(segment(factTypeSeg(page), "Periodic")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("field-cube-factless").getByRole("button", { name: "Factless fact" })).toHaveAttribute("aria-pressed", "true");
  await undoButton(page).click();
  await expect.poll(async () => (await row("sales"))?.is_factless).toBe(false);
  await undoButton(page).click();
  await expect.poll(async () => (await row("sales"))?.fact_type).toBe("transaction");
  await redoButton(page).click();
  await expect.poll(async () => (await row("sales"))?.fact_type).toBe("periodic");

  // the base, Fact Sales' own aggregate is Fact Orders: clear it on Fact Orders
  await openEntity(page, "Fact Orders");
  await page.getByTestId("select-cube-base").selectOption("");
  await expect.poll(async () => (await row("orders"))?.base_fact_entity_id).toBeNull();
  await page.reload();
  await hydrated(page);
  await openEntity(page, "Fact Orders");
  await expect(page.getByTestId("select-cube-base")).toHaveValue("");
  await undoButton(page).click();
  await expect.poll(async () => (await row("orders"))?.base_fact_entity_id).toBe(typeEntity("sales"));
  await redoButton(page).click();
  await expect.poll(async () => (await row("orders"))?.base_fact_entity_id).toBeNull();

  // a dimension's kind, history and snapshot period, Dim Date
  await openEntity(page, "Dim Date");
  await segment(kindSeg(page), "Junk").click();
  await expect.poll(async () => (await row("date"))?.dim_kind).toBe("junk");
  await segment(historySeg(page), "Snapshot").click();
  await expect.poll(async () => (await row("date"))?.history).toBe("snapshot");
  await expect(periodField(page)).toBeFocused();
  await periodField(page).fill("Daily");
  await periodField(page).press("Tab");
  await expect.poll(async () => (await row("date"))?.snapshot_period).toBe("Daily");
  await page.reload();
  await hydrated(page);
  await openEntity(page, "Dim Date");
  await expect(segment(kindSeg(page), "Junk")).toHaveAttribute("aria-pressed", "true");
  await expect(segment(historySeg(page), "Snapshot")).toHaveAttribute("aria-pressed", "true");
  await expect(periodField(page)).toHaveValue("Daily");
  await undoButton(page).click();
  await expect.poll(async () => (await row("date"))?.snapshot_period).toBeNull();
  await undoButton(page).click();
  await expect.poll(async () => (await row("date"))?.history).toBe("keep");
  await undoButton(page).click();
  await expect.poll(async () => (await row("date"))?.dim_kind).toBe("standard");
  await redoButton(page).click();
  await redoButton(page).click();
  await redoButton(page).click();
  await expect.poll(async () => [(await row("date"))?.dim_kind, (await row("date"))?.history, (await row("date"))?.snapshot_period]).toEqual(["junk", "snapshot", "Daily"]);
});
