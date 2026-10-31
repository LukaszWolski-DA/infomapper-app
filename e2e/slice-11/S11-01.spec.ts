import { expect, test } from "./fixtures";
import { archive, attributeOf, canvasUrl, FULL, hydrated, loadModel, openCanvas, openEntityFromTree, rowNamed, SEED_IDS, setEntityAlias, signInAs, undo } from "./helpers";

// Alias fields (item 6): saved in the panels on the save chain, one undo step each; an empty field stores none; the
// names stay everywhere outside the canvas; reviewers cannot edit, a direct call is refused, and so is any write in an
// archived workspace.

const aliasOf = async (name: string) => (await loadModel()).entities.find((e) => e.name === name)!.alias;
const attributeAlias = async () => (await attributeOf("Customer", "customer_id")).alias;

test("S11-01: Customer's and customer_id's aliases are saved in their panels, one undo step each; an empty field stores none", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FULL);
  await hydrated(page);
  await openEntityFromTree(page, "Customer");
  const entityField = page.getByTestId("panel-entity").getByTestId("input-entity-alias");
  await expect(entityField).toHaveAttribute("placeholder", "Another name, e.g. in Polish");
  await entityField.fill("  Klient ");
  await entityField.press("Enter");
  await expect.poll(() => aliasOf("Customer")).toBe("Klient");

  // the names stay outside the canvas: the panel's name, the object browser's list, the canvas in names mode
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Customer");
  await expect(page.getByTestId("tree-item").filter({ hasText: "Klient" })).toHaveCount(0);
  await expect(page.getByTestId("tree-item").filter({ has: page.getByText("Customer", { exact: true }) })).toHaveCount(1);
  await expect(page.getByTestId("card-name").getByText("Customer", { exact: true })).toBeVisible();

  await undo(page);
  await expect.poll(() => aliasOf("Customer")).toBeNull();

  await rowNamed(page, "Customer", "customer_id").click();
  const attributeField = page.getByTestId("panel-attribute").getByTestId("input-attribute-alias");
  await attributeField.fill("Numer klienta");
  await attributeField.press("Enter");
  await expect.poll(attributeAlias).toBe("Numer klienta");
  await expect(page.getByTestId("input-attribute-name")).toHaveValue("customer_id");
  await undo(page);
  await expect.poll(attributeAlias).toBeNull();

  // clearing the field stores no alias
  await expect(attributeField).toHaveValue("");
  await attributeField.fill("Numer klienta");
  await attributeField.press("Enter");
  await expect.poll(attributeAlias).toBe("Numer klienta");
  // the panel shows the stored row before the next edit: a fresh page arriving later would remount the field
  const stored = await attributeOf("Customer", "customer_id");
  await expect(page.getByTestId("panel-attribute")).toHaveAttribute("data-version", String(stored.version));
  await attributeField.fill("");
  await attributeField.press("Enter");
  await expect.poll(attributeAlias).toBeNull();
});

test("S11-01: a reviewer cannot edit the alias and a direct call is refused; an archived workspace refuses the write", async ({ page }) => {
  await signInAs(page, "Piotr Wiśniewski");
  await openCanvas(page, canvasUrl(), FULL);
  await openEntityFromTree(page, "Customer");
  await expect(page.getByTestId("panel-entity").getByTestId("input-entity-alias")).toHaveJSProperty("readOnly", true);
  await expect(setEntityAlias("Customer", "Klient", SEED_IDS.userPiotr)).rejects.toThrow("As a reviewer you cannot edit the model.");

  await archive();
  await expect(setEntityAlias("Customer", "Klient")).rejects.toThrow(/archived/);
  expect(await aliasOf("Customer")).toBeNull();
});
