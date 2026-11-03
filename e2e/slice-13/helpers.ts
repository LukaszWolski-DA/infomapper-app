// Slice 13's e2e helpers (D-66): a save's answer held until the test releases it, the caret of a field, and test data
// as another session through the domain.

import { expect, type Locator, type Page } from "@playwright/test";
import { updateEntity } from "../../src/domain/commands/entity";
import { updateProject } from "../../src/domain/commands/project";
import { updateRequirement } from "../../src/domain/commands/requirement";
import { setSourceNote } from "../../src/domain/commands/source";
import { updateWorkspaceSettings } from "../../src/domain/commands/workspace";
import { asUser, loadModel, requirementByKey, SEED_IDS, store } from "../slice-12a/helpers";

export * from "../slice-12a/helpers";
export { openTable } from "../slice-07c/helpers";

/**
 * Holds back the browser's answer to the first server action whose body contains `bodyHas` until the test calls
 * `release` (slice 10c's `holdAnswer`, with a release instead of a fixed time): the request reaches the server at once
 * and is written there. A Playwright route on this page only, so the app has no switch for it in any build.
 */
export async function holdUntil(page: Page, bodyHas: string) {
  let held = false;
  let release!: () => void;
  const gate = new Promise<void>((done) => (release = done));
  let answered!: () => void;
  const given = new Promise<void>((done) => (answered = done));
  await page.route("**/*", async (route) => {
    const r = route.request();
    if (!held && r.method() === "POST" && r.headers()["next-action"] && (r.postData() ?? "").includes(bodyHas)) {
      held = true;
      const response = await route.fetch();
      await gate;
      // a test that failed or timed out meanwhile has closed the page: nothing is left to answer
      await route.fulfill({ response }).catch(() => {});
      answered();
    } else await route.continue().catch(() => {});
  });
  return { held: () => held, release, given };
}

/** The field's caret: where the selection starts and ends, and the text's length. */
export const caretOf = (field: Locator) =>
  field.evaluate((el: HTMLInputElement | HTMLTextAreaElement) => ({ start: el.selectionStart, end: el.selectionEnd, length: el.value.length }));

/** Expects the caret at the end of the field's text, nothing selected. */
export async function expectCaretAtEnd(field: Locator) {
  const c = await caretOf(field);
  expect(c).toEqual({ start: c.length, end: c.length, length: c.length });
}

/** The entity of Retail Co – DWH by name. */
export const entityNamed = async (name: string) => (await loadModel()).entities.find((e) => e.name === name)!;

/** Customer 360 changed by Anna, as another session would (the page does not know). */
export async function changeProjectAsAnna(projectId: string, change: { name?: string; description?: string }) {
  const project = (await store().projects.get(SEED_IDS.wsRetailDwh, projectId))!;
  await asUser(SEED_IDS.userAnna, (ctx, access) => updateProject(ctx, access, { project }, { projectId, expectedVersion: project.version, ...change }));
}

// ---- step 3: conflicts (items 7–8) ----

/** The line under a field (or in the rich-text dialog) after a conflict, and its parts. */
export const conflictLine = (scope: Page | Locator) => scope.getByTestId("draft-conflict");
export const otherValue = (scope: Page | Locator) => scope.getByTestId("draft-other");
export const notSaved = (scope: Page | Locator) => scope.getByTestId("draft-not-saved");
export const useThis = (scope: Page | Locator) => scope.getByTestId("button-use-this");
export const keepMine = (scope: Page | Locator) => scope.getByTestId("button-keep-mine");

/** An entity changed by Anna, as another session would (the page does not know). */
export async function changeEntityAsAnna(name: string, change: { name?: string; alias?: string | null; stereotype?: string }) {
  const model = await loadModel();
  const entity = model.entities.find((e) => e.name === name)!;
  await asUser(SEED_IDS.userAnna, (ctx, access) => updateEntity(ctx, access, { entity, entities: model.entities, concept: null }, { entityId: entity.id, expectedVersion: entity.version, ...change }));
}

/** A source table's note changed by Anna. */
export async function changeTableNoteAsAnna(table: string, note: string | null) {
  const t = (await loadModel()).sourceTables.find((x) => x.name === table)!;
  await asUser(SEED_IDS.userAnna, (ctx, access) => setSourceNote(ctx, access, { table: t }, { target: { kind: "source_table", id: t.id }, expectedVersion: t.version, note }));
}

/** A requirement's field changed by Anna. */
export async function changeRequirementAsAnna(key: string, field: string, value: string | null) {
  const r = await requirementByKey(key);
  await asUser(SEED_IDS.userAnna, (ctx, access) => updateRequirement(ctx, access, { requirements: [r] }, { requirementId: r.id, expectedVersion: r.version, field, value }));
}

/** The workspace's settings changed by Łukasz in another session (Anna is no admin). */
export async function changeSettingsElsewhere(change: { name?: string; description?: string }) {
  const ws = (await store().workspaces.get(SEED_IDS.wsRetailDwh))!;
  await asUser(SEED_IDS.userLukasz, (ctx, access) => updateWorkspaceSettings(ctx, access, { workspaceId: ws.id, expectedVersion: ws.version, ...change }));
}
