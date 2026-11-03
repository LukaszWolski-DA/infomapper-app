import { expect, test } from "./fixtures";
import { canvasUrl, changeEntityAsAnna, conflictLine, entityNamed, expectToast, FULL, hydrated, loadModel, notSaved, openCanvas, openEntityFromTree, otherValue, recordToasts, signInAs, STALE, toasts } from "./helpers";

// S13-05 (items 7–8, F5): saves cut behind a conflict. Anna changes the entity (its stereotype, or its alias too); this
// page saves the name and at once the alias. The name's save is refused as stale and the alias's is cut: a field whose
// own stored value did not change shows "Not saved" and is saved again on leaving it; one whose value Anna changed
// shows the conflict line.

async function nameThenAlias(page: import("@playwright/test").Page) {
  const panel = page.getByTestId("panel-entity");
  const name = panel.getByTestId("input-entity-name");
  const alias = panel.getByTestId("input-entity-alias");
  await name.fill("Kunde");
  await name.press("Tab"); // the name's save starts; Tab puts the focus in the alias
  await alias.fill("Klient");
  await alias.press("Enter"); // queued behind the name's save, cut by its refusal
  return { panel, name, alias };
}

async function open(page: import("@playwright/test").Page) {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FULL);
  await hydrated(page);
  await openEntityFromTree(page, "Customer");
}

test("S13-05: Anna changed the stereotype: the name and the alias show Not saved; leaving each again saves it", async ({ page }) => {
  const customer = await entityNamed("Customer");
  await open(page);
  await changeEntityAsAnna("Customer", { stereotype: "context" });
  const { panel, name, alias } = await nameThenAlias(page);
  await expectToast(page, STALE);
  await expect(notSaved(panel)).toHaveCount(2);
  await expect(conflictLine(panel)).toHaveCount(0);
  await expect(name).toHaveValue("Kunde");
  await expect(alias).toHaveValue("Klient");
  expect(await toasts(page)).toEqual([STALE]); // one toast for the refusal and its cut save

  await name.click();
  await name.press("Enter");
  await expect.poll(async () => (await loadModel()).entities.find((e) => e.id === customer.id)!.name).toBe("Kunde");
  await alias.click();
  await alias.press("Enter");
  await expect.poll(async () => (await loadModel()).entities.find((e) => e.id === customer.id)!.alias).toBe("Klient");
  await expect(notSaved(panel)).toHaveCount(0);
  expect((await loadModel()).entities.find((e) => e.id === customer.id)!.stereotype).toBe("context");
});

test("S13-05: Anna changed the alias too: the alias shows the conflict line, the name Not saved", async ({ page }) => {
  await open(page);
  await changeEntityAsAnna("Customer", { alias: "Kundin" });
  const { panel } = await nameThenAlias(page);
  await expectToast(page, STALE);
  await expect(otherValue(panel)).toHaveText("Kundin");
  await expect(conflictLine(panel)).toHaveCount(1);
  await expect(notSaved(panel)).toHaveCount(1);
});
