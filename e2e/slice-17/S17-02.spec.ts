// S17-02 (slice 17, item 2 a and b, D-72): two requirements checked in an attribute's picker give two links, one undo
// removes both; linked ones are checked and disabled. "Link all attributes…" on an entity with an attribute already
// linked adds the others only, one undo step. The same on a dimension. A reader sees neither.

import { test as starTest } from "../slice-15a/fixtures";
import { expect, test } from "./fixtures";
import {
  entityIdOf,
  expectToast,
  headOf,
  ids,
  linkFromPanel,
  loadModel,
  loadRequirementLinks,
  openCanvas,
  openEntityFromTree,
  requirementByKey,
  row,
  signInAs,
  STAR_VIEW,
  starUrl,
  undoButton,
  WHOLE_CO,
} from "./helpers";

const linksOf = async (key: string) => {
  const r = await requirementByKey(key);
  return (await loadRequirementLinks()).filter((k) => k.requirement_id === r.id && k.deleted_at === null);
};

test("S17-02: two requirements at once on an attribute, one undo removes both; linked ones are checked and disabled", async ({ page }) => {
  const { attribute } = await ids();
  const email = attribute("Customer", "email");
  await signInAs(page, "Łukasz");
  await openCanvas(page, undefined, WHOLE_CO);
  await row(page, "Customer", email.id).click();
  await expect(page.getByTestId("panel-attribute")).toBeVisible();

  // REQ-102 and REQ-103 are linked to email in the seed: checked and disabled, titled "Already linked"
  await page.getByTestId("button-link-requirements").click();
  const picker = page.getByTestId("picker-requirements");
  await expect(picker).toHaveAttribute("data-shown", "true");
  for (const key of ["REQ-102", "REQ-103"]) {
    const it = picker.locator(`[data-testid="picker-item"][data-key="${key}"]`);
    await expect(it).toBeDisabled();
    await expect(it).toHaveAttribute("aria-checked", "true");
    await expect(it).toHaveAttribute("title", "Already linked");
  }
  await expect(picker.getByTestId("picker-confirm")).toBeDisabled();
  await expect(picker.getByTestId("picker-confirm")).toHaveText("Link");
  await page.keyboard.press("Escape");

  const [b101, b104] = [(await linksOf("REQ-101")).length, (await linksOf("REQ-104")).length];
  await linkFromPanel(page, ["REQ-101", "REQ-104"]);
  await expectToast(page, "Linked 2 requirements to the attribute.");
  await expect.poll(async () => [(await linksOf("REQ-101")).length, (await linksOf("REQ-104")).length]).toEqual([b101 + 1, b104 + 1]);

  await undoButton(page).click();
  await expectToast(page, "Undone: Link requirements");
  await expect.poll(async () => [(await linksOf("REQ-101")).length, (await linksOf("REQ-104")).length]).toEqual([b101, b104]);
});

test("S17-02: “Link all attributes…” links the other attributes only, in one undo step", async ({ page }) => {
  const m = await loadModel();
  const customer = m.entities.find((e) => e.name === "Customer")!;
  const attributes = m.attributes.filter((a) => a.entity_id === customer.id);
  const before = await linksOf("REQ-102"); // first_name, last_name and email
  await signInAs(page, "Łukasz");
  await openCanvas(page, undefined, WHOLE_CO);
  await openEntityFromTree(page, "Customer");
  await linkFromPanel(page, ["REQ-102"], { all: true });
  const added = attributes.length - before.length;
  await expectToast(page, `Linked ${added} attributes of Customer to REQ-102.`);
  await expect.poll(async () => (await linksOf("REQ-102")).length).toBe(attributes.length);
  // no second link on the attributes that had one
  const after = await linksOf("REQ-102");
  expect(new Set(after.map((k) => k.attribute_id)).size).toBe(after.length);

  await undoButton(page).click();
  await expect.poll(async () => (await linksOf("REQ-102")).map((k) => k.id).sort()).toEqual(before.map((k) => k.id).sort());
});

starTest("S17-02: “Link all attributes…” on a dimension", async ({ page }) => {
  const dim = entityIdOf("cust");
  const attributes = (await loadModel()).attributes.filter((a) => a.entity_id === dim && a.deleted_at === null);
  const before = (await linksOf("REQ-210")).filter((k) => attributes.some((a) => a.id === k.attribute_id)).length;
  await signInAs(page, "Łukasz");
  await openCanvas(page, starUrl(), STAR_VIEW);
  await headOf(page, "Dim Customer").click();
  await expect(page.getByTestId("panel-entity")).toBeVisible();
  await linkFromPanel(page, ["REQ-210"], { all: true });
  await expectToast(page, `Linked ${attributes.length - before} attributes of Dim Customer to REQ-210.`);
  await expect.poll(async () => (await linksOf("REQ-210")).filter((k) => attributes.some((a) => a.id === k.attribute_id)).length).toBe(attributes.length);
});

test("S17-02: a reader sees neither button", async ({ page }) => {
  await signInAs(page, "Kasia Zielińska");
  await openCanvas(page, undefined, WHOLE_CO);
  await openEntityFromTree(page, "Customer");
  await expect(page.getByTestId("section-requirements")).toBeVisible();
  await expect(page.getByTestId("button-link-requirements")).toHaveCount(0);
  await expect(page.getByTestId("button-link-all-attributes")).toHaveCount(0);
});
