import { createLocalDataStore } from "../../src/data/local/store";
import { E2E_DB } from "../config";
import { expect, test } from "./fixtures";
import { callActionDirectly, captureActionId, createFromSwitcher, expectToast, newSession, SEED_IDS } from "./helpers";

const ws = SEED_IDS.wsRetailDwh;
const events = () => createLocalDataStore(E2E_DB).changeEvents.list(ws);

test("S0-09: every successful write adds change events sharing one change group, with before and after images; refused writes add none", async ({ browser }) => {
  expect(await events()).toEqual([]);

  // a create: project + first canvas + their link, one change group
  const owner = await newSession(browser, "Łukasz");
  const createProjectId = await captureActionId(owner.page, () =>
    createFromSwitcher(owner.page, "switcher-project", "input-new-project", "Finance"),
  );
  await expectToast(owner.page, "Created the project Finance.");
  const created = await events();
  expect(created.map((e) => `${e.operation} ${e.object_type}`)).toEqual([
    "create project",
    "create canvas",
    "create project_canvas",
  ]);
  expect(new Set(created.map((e) => e.change_group_id)).size).toBe(1);
  for (const e of created) {
    expect(e.user_id).toBe(SEED_IDS.userLukasz);
    expect(e.before_image).toBeNull();
    expect(e.after_image).not.toBeNull();
  }
  expect(created[0]!.after_image).toMatchObject({ name: "Finance", version: 1, workspace_id: ws });

  // an update: before and after images
  await owner.page.goto(`/w/${ws}?tab=settings`);
  await owner.page.getByTestId("checkbox-four-eyes").check();
  await expectToast(owner.page, "Four-eyes approval is on.");
  const all = await events();
  expect(all).toHaveLength(4);
  const update = all[3]!;
  expect(update.change_group_id).not.toBe(created[0]!.change_group_id);
  expect(update).toMatchObject({
    operation: "update",
    object_type: "workspace",
    object_id: ws,
    before_image: { four_eyes: false, version: 1 },
    after_image: { four_eyes: true, version: 2 },
  });

  // refused writes add nothing: a reviewer's direct call, and a stale version
  const reviewer = await newSession(browser, "Piotr Wiśniewski");
  expect(await callActionDirectly(reviewer.page, createProjectId, [{ workspaceId: ws, name: "Sneaky" }])).toContain(
    "As a reviewer you cannot create projects.",
  );
  await owner.page.getByTestId("input-workspace-name").fill("Stale"); // this page holds version 2
  const second = await newSession(browser, "Łukasz");
  await second.page.goto(`/w/${ws}?tab=settings`);
  await second.page.getByTestId("checkbox-dv2").check(); // version 2 -> 3
  await expectToast(second.page, "Data Vault 2.0 mode is on.");
  expect(await events()).toHaveLength(5);
  await owner.page.getByTestId("input-workspace-name").press("Enter"); // still on version 2: refused
  await expectToast(owner.page, "Someone changed this meanwhile. Reload to see the latest version.");
  expect(await events()).toHaveLength(5);
});
