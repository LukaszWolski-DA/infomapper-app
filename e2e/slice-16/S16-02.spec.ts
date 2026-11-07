// S16-02 (slice 16, item 1, D-71): "Add attribute" is not in an attribute row's menu, not on a table card's header,
// not for a reviewer or a reader (a direct call refused), and refused in an archived workspace.

import { addAttribute } from "../../src/domain/commands/attribute";
import { expect, test, type Page } from "./fixtures";
import { archive, canvasUrl, card, headOf, loadModel, openCanvas, RETAIL, rowNamed, SEED_IDS, signInAs, store, toolboxAt, WHOLE_CO } from "./helpers";

const headPoint = async (page: Page, cardName: string) => {
  const b = (await headOf(page, cardName).boundingBox())!;
  return { x: b.x + Math.min(30, b.width / 2), y: b.y + b.height / 2 };
};
const centre = async (page: Page, l: ReturnType<typeof card>) => {
  const b = (await l.boundingBox())!;
  return { x: b.x + Math.min(30, b.width / 2), y: b.y + b.height / 2 };
};
/** "Add attribute" on Customer called directly as a person: the refusal's code, or null when it would be allowed. */
async function refusalCode(userId: string): Promise<string | null> {
  const s = store();
  const workspace = (await s.workspaces.get(RETAIL))!;
  const access = { workspace, member: await s.workspaces.getMember(RETAIL, userId) };
  const model = await loadModel();
  const entity = model.entities.find((e) => e.name === "Customer")!;
  const r = addAttribute({ actorId: userId, now: new Date().toISOString(), newId: () => crypto.randomUUID() }, access, { entity, attributes: model.attributes }, { entityId: entity.id });
  return r.ok ? null : r.error.code;
}

test("S16-02: not in a row's menu, not on a table card", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  expect(await toolboxAt(page, await centre(page, rowNamed(page, "Customer", "email")))).not.toContain("Add attribute");
  await page.keyboard.press("Escape");
  const table = card(page, "customers");
  const tableHead = table.locator(".c-head");
  expect(await toolboxAt(page, await centre(page, tableHead))).not.toContain("Add attribute");
  await page.keyboard.press("Escape");
  // the entity header next to them does have it
  expect(await toolboxAt(page, await headPoint(page, "Customer"))).toContain("Add attribute");
});

for (const who of ["Piotr Wiśniewski", "Kasia Zielińska"] as const) {
  test(`S16-02: ${who} (${who.startsWith("Piotr") ? "reviewer" : "reader"}) gets no "Add attribute", and a direct call is refused`, async ({ page }) => {
    await signInAs(page, who);
    await openCanvas(page, canvasUrl(), WHOLE_CO);
    await page.mouse.click(...(Object.values(await headPoint(page, "Customer")) as [number, number]), { button: "right" });
    await expect(page.getByTestId("menu-toolbox").getByRole("menuitem", { name: "Add attribute", exact: true })).toHaveCount(0);
    expect(await refusalCode(who.startsWith("Piotr") ? SEED_IDS.userPiotr : SEED_IDS.userKasia)).toBe("forbidden");
  });
}

test("S16-02: refused in an archived workspace, and not offered there", async ({ page }) => {
  expect(await refusalCode(SEED_IDS.userLukasz)).toBeNull();
  await archive();
  expect(await refusalCode(SEED_IDS.userLukasz)).toBe("archived");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await page.mouse.click(...(Object.values(await headPoint(page, "Customer")) as [number, number]), { button: "right" });
  await expect(page.getByTestId("menu-toolbox").getByRole("menuitem", { name: "Add attribute", exact: true })).toHaveCount(0);
});
