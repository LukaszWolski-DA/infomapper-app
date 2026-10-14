import { expect, test, type Page } from "./fixtures";
import {
  callActionDirectly,
  canvasUrl,
  captureActionId,
  ids,
  loadRequirementLinks,
  loadRequirements,
  newSession,
  openCanvas,
  openEntityFromTree,
  openRequirement,
  openRequirementsTab,
  pickOption,
  requirementByKey,
  SEED_IDS,
  signInAs,
} from "./helpers";

const REVIEWER = "As a reviewer you can only change a requirement's status.";
const READER = "As a reader you cannot change requirements.";
const ARCHIVED = "This workspace is archived, so it is read-only.";

/** Everything a reviewer or reader must not see on a requirement and an element panel. */
async function expectReadOnly(page: Page) {
  await openRequirement(page, "REQ-103");
  for (const id of ["input-req-key", "input-req-name", "input-req-owner", "input-req-ref"]) await expect(page.getByTestId(id)).toHaveAttribute("readonly", "");
  for (const id of ["select-req-kind", "select-req-parent"]) await expect(page.getByTestId(id)).toBeDisabled();
  for (const b of await page.getByTestId("seg-req-priority").getByRole("button").all()) await expect(b).toBeDisabled();
  for (const id of ["field-req-description-edit", "button-trace-unlink", "button-delete-requirement"]) await expect(page.getByTestId(id)).toHaveCount(0);
  await openEntityFromTree(page, "Customer");
  await expect(page.getByTestId("section-requirements")).toBeVisible();
  for (const id of ["select-link-requirement", "button-requirement-unlink"]) await expect(page.getByTestId(id)).toHaveCount(0);
  await openRequirementsTab(page);
  await expect(page.getByTestId("button-new-requirement")).toHaveCount(0);
}

test("S4A-11: roles: Piotr changes REQ-103's status and nothing else, his other writes sent directly are refused; Kasia changes nothing; in the archived workspace nothing changes", async ({ page, browser }) => {
  const { entity } = await ids();
  const r103 = await requirementByKey("REQ-103");
  const ws = r103.workspace_id;

  // the actions' ids, captured from Łukasz's own steps (an owner)
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await openRequirement(page, "REQ-104");
  const update = await captureActionId(page, async () => {
    await page.getByTestId("input-req-owner").fill("Controller");
    await page.getByTestId("input-req-owner").press("Enter");
  });
  await openEntityFromTree(page, "Customer");
  const link = await captureActionId(page, () => pickOption(page.getByTestId("select-link-requirement"), "REQ-104"));
  await expect.poll(async () => (await loadRequirementLinks()).length).toBe(14);
  const unlink = await captureActionId(page, () => page.locator('[data-testid="item-requirement"][data-key="REQ-104"]').getByTestId("button-requirement-unlink").click());
  await openRequirementsTab(page);
  const create = await captureActionId(page, () => page.getByTestId("button-new-requirement").click());
  await expect(page.getByTestId("input-req-key")).toHaveValue("REQ-106");
  const remove = await captureActionId(page, () => page.getByTestId("button-delete-requirement").click());
  await expect.poll(async () => (await loadRequirements()).length).toBe(5);
  const owned = await requirementByKey("REQ-104");
  const linkRow = (await loadRequirementLinks())[0]!;

  // Piotr: the status, nothing else
  const piotr = await newSession(browser, "Piotr Wiśniewski");
  await openCanvas(piotr.page);
  await expectReadOnly(piotr.page);
  await openRequirement(piotr.page, "REQ-103");
  await piotr.page.getByTestId("seg-req-status").getByRole("button", { name: "Implemented", exact: true }).click();
  await expect.poll(async () => (await requirementByKey("REQ-103")).status).toBe("implemented");
  const sent = {
    update: await callActionDirectly(piotr.page, update, [ws, { requirementId: owned.id, expectedVersion: owned.version, field: "name", value: "Hijacked" }]),
    link: await callActionDirectly(piotr.page, link, [ws, { requirementId: owned.id, target: { kind: "entity", id: entity("Sales Order").id } }]),
    unlink: await callActionDirectly(piotr.page, unlink, [ws, { requirementLinkId: linkRow.id, expectedVersion: linkRow.version }]),
    create: await callActionDirectly(piotr.page, create, [ws, {}]),
    remove: await callActionDirectly(piotr.page, remove, [ws, { requirementId: owned.id, expectedVersion: owned.version }]),
  };
  for (const body of Object.values(sent)) expect(body).toContain(REVIEWER);
  expect(await requirementByKey("REQ-104")).toMatchObject({ name: owned.name, version: owned.version });
  expect((await loadRequirements()).length).toBe(5);
  expect((await loadRequirementLinks()).length).toBe(13);
  await piotr.context.close();

  // Kasia: nothing, the status included
  const kasia = await newSession(browser, "Kasia Zielińska");
  await openCanvas(kasia.page);
  await expectReadOnly(kasia.page);
  await openRequirement(kasia.page, "REQ-103");
  for (const b of await kasia.page.getByTestId("seg-req-status").getByRole("button").all()) await expect(b).toBeDisabled();
  const r = await requirementByKey("REQ-103");
  const statusAction = await captureActionId(page, async () => {
    await page.reload(); // Piotr changed REQ-103 meanwhile
    await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
    await openRequirement(page, "REQ-103");
    await page.getByTestId("seg-req-status").getByRole("button", { name: "Verified", exact: true }).click();
  });
  await expect.poll(async () => (await requirementByKey("REQ-103")).status).toBe("verified");
  const r2 = await requirementByKey("REQ-103");
  expect(await callActionDirectly(kasia.page, statusAction, [ws, { requirementId: r.id, expectedVersion: r2.version, status: "draft" }])).toContain(READER);
  expect(await callActionDirectly(kasia.page, update, [ws, { requirementId: r.id, expectedVersion: r2.version, field: "name", value: "x" }])).toContain(READER);
  expect((await requirementByKey("REQ-103")).status).toBe("verified");
  await kasia.context.close();

  // the archived workspace (Bank X, Łukasz is its owner): no “New requirement”, a create sent directly is refused
  await openCanvas(page, canvasUrl(SEED_IDS.canvasBankFirst, SEED_IDS.projBankFirst, SEED_IDS.wsBankX));
  await openRequirementsTab(page);
  await expect(page.getByTestId("text-req-empty")).toHaveText("No requirements yet.");
  await expect(page.getByTestId("button-new-requirement")).toHaveCount(0);
  expect(await callActionDirectly(page, create, [SEED_IDS.wsBankX, {}])).toContain(ARCHIVED);
});
