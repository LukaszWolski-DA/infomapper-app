import { expect, test } from "./fixtures";
import { card, chipNames, labelNamed, labelsField, loadLinks, openCanvas, removeLabel, rowNamed, signInAs, typeLabel, undo, canvasUrl, WHOLE_CO } from "./helpers";

test("S3A-01: typing “cr 23” on Customer offers “Create “cr-23”” first, Enter creates and assigns it; “CR” on an attribute suggests it with its item count; × removes it; each is one undo step", async ({ page }) => {
  // the demo's CR-23 goes first, so no label has that name
  await removeLabel("CR-23");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);

  // Customer: the typed name comes first as “Create …”, normalised
  await card(page, "Customer").getByTestId("card-name").click();
  await expect(page.getByTestId("panel-entity")).toBeVisible();
  await typeLabel(page, "cr 23");
  const options = labelsField(page).locator("..").getByTestId("option-label");
  await expect(options.first()).toHaveAttribute("data-kind", "new");
  await expect(options.first()).toContainText("Create “cr-23”");
  await page.keyboard.press("Enter");
  await expect.poll(() => chipNames(page)).toEqual(["cr-23"]);
  // the input keeps the focus
  await expect(labelsField(page).getByTestId("input-label")).toBeFocused();
  const label = (await labelNamed("cr-23"))!;
  expect(label).toBeDefined();
  expect((await loadLinks()).filter((k) => k.label_id === label.id).map((k) => k.entity_id)).toHaveLength(1);

  // one undo step takes the new label and its link away
  await undo(page);
  await expect.poll(async () => (await labelNamed("cr-23")) ?? null).toBeNull();
  await expect.poll(() => chipNames(page)).toEqual([]);
  // again, for the rest of the test
  await typeLabel(page, "cr 23");
  await page.keyboard.press("Enter");
  await expect.poll(() => chipNames(page)).toEqual(["cr-23"]);

  // an attribute: “CR” suggests the existing label with its item count, below “Create “CR””
  await rowNamed(page, "Customer", "email").click();
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  await typeLabel(page, "CR");
  const existing = labelsField(page).locator("..").getByTestId("option-label").filter({ hasText: "cr-23" });
  await expect(existing).toHaveAttribute("data-kind", "use");
  await expect(existing).toContainText("1 item");
  await existing.dispatchEvent("pointerdown");
  await expect.poll(() => chipNames(page)).toEqual(["cr-23"]);
  const created = (await labelNamed("cr-23"))!;
  await expect.poll(async () => (await loadLinks()).filter((k) => k.label_id === created.id).length).toBe(2);

  // × removes it from the attribute, one undo step puts it back
  await labelsField(page).getByTestId("button-label-remove").click();
  await expect.poll(() => chipNames(page)).toEqual([]);
  await expect.poll(async () => (await loadLinks()).filter((k) => k.label_id === created.id).length).toBe(1);
  await undo(page);
  await expect.poll(async () => (await loadLinks()).filter((k) => k.label_id === created.id).length).toBe(2);
  await expect.poll(() => chipNames(page)).toEqual(["cr-23"]);
});
