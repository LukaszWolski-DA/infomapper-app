// Slice 3b's steps on top of slice 3a's: test data written as the server writes it (the command, then the live step
// `completeLiveWrites`, as `runCommand` does: labels of placed cards and the sync of every live canvas), a label's live
// canvas made as test data, the working context switched on in the browser, and the miniature's commit counter.

import { uuidv7 } from "../../src/domain/ids";
import type { CommandContext, CommandResult } from "../../src/domain/changes";
import { addLabel } from "../../src/domain/commands/label";
import { completeLiveWrites, openLiveCanvas, type LiveWriteState } from "../../src/domain/commands/live";
import type { LabelTarget } from "../../src/domain/model/labels";
import type { WorkspaceAccess } from "../../src/domain/permissions";
import { contextCookieName, formatContextCookie } from "../../src/ui/working-context-cookie";
import { expect, type Page } from "./fixtures";
import { canvasUrl, labelNamed, RETAIL, SEED_IDS, store } from "../slice-03a/helpers";

export * from "../slice-03a/helpers";

/** How many times the Overview's miniature committed (development only, `Overview.tsx`). */
export const miniatureCommits = (page: Page) => page.evaluate(() => (window as unknown as { __imMiniatureCommits?: number }).__imMiniatureCommits ?? 0);

/** How many times the canvas committed (development only, slice 2c). */
export const canvasCommits = (page: Page) => page.evaluate(() => (window as unknown as { __imCanvasCommits?: number }).__imCanvasCommits ?? 0);

/** The notes the miniature draws, by colour. */
export const miniNoteColors = (page: Page) =>
  page.getByTestId("mini-note").evaluateAll((els) => els.map((e) => (e as SVGElement).dataset.color ?? "").sort());

/** Everything the live rules read, from the e2e data file. */
export async function liveState(): Promise<LiveWriteState> {
  const s = store();
  const [model, labels, labelLinks, canvases, canvasItems, frames, notes] = await Promise.all([
    s.model.load(RETAIL),
    s.labels.list(RETAIL),
    s.labels.listLinks(RETAIL),
    s.canvases.list(RETAIL),
    s.canvasItems.list(RETAIL),
    s.frames.list(RETAIL),
    s.notes.list(RETAIL),
  ]);
  return { ...model, labels, labelLinks, canvases, canvasItems, frames, notes };
}

/** Test data written as the server writes it: the command, then the live step, then the adapter. */
export async function liveWrite<T>(command: (ctx: CommandContext, access: WorkspaceAccess, state: LiveWriteState) => CommandResult<T>, userId: string = SEED_IDS.userLukasz): Promise<T> {
  const s = store();
  const workspace = (await s.workspaces.get(RETAIL))!;
  const access = { workspace, member: await s.workspaces.getMember(RETAIL, userId) };
  const ctx = { actorId: userId, now: new Date().toISOString(), newId: () => uuidv7() };
  const state = await liveState();
  const result = command(ctx, access, state);
  if (!result.ok) throw new Error(result.error.message);
  const completed = completeLiveWrites(ctx, access, state, result.writeSet);
  if (!completed.ok) throw new Error(completed.error.message);
  const applied = await s.apply(completed.writeSet);
  if (!applied.ok) throw new Error(applied.error.message);
  return result.value;
}

/** Test data: a label's live canvas, made in a project as “Open as live canvas” makes it. Returns the canvas id. */
export async function openLiveFor(labelName: string, projectId: string = SEED_IDS.projCustomer360): Promise<string> {
  const label = (await labelNamed(labelName))!;
  const project = await store().projects.get(RETAIL, projectId);
  const projectLinks = (await Promise.all((await store().projects.list(RETAIL)).map((p) => store().canvases.listLinksOfProject(RETAIL, p.id)))).flat();
  const value = await liveWrite((ctx, access, state) => openLiveCanvas(ctx, access, { ...state, project, projectLinks }, { labelId: label.id, projectId }));
  return value.canvasId;
}

/** Test data: a label (by name, made when missing) put on an item, through the live step. */
export async function labelItem(name: string, target: LabelTarget): Promise<void> {
  const label = await labelNamed(name);
  await liveWrite((ctx, access, state) => addLabel(ctx, access, { ...state, links: state.labelLinks }, label ? { target, labelId: label.id } : { target, name }));
}

/** A live canvas's address in a project. */
export const liveUrl = (canvasId: string, projectId: string = SEED_IDS.projCustomer360) => canvasUrl(canvasId, projectId);

/** Switches the working context on for a person in the browser, as the switch does (its cookie). */
export async function contextOn(page: Page, labelName: string, userId: string = SEED_IDS.userLukasz): Promise<void> {
  const label = (await labelNamed(labelName))!;
  const url = new URL(page.url() === "about:blank" ? "http://localhost:3200" : page.url());
  await page.context().addCookies([{ name: contextCookieName(userId, RETAIL), value: formatContextCookie(label.id, label.name), domain: url.hostname, path: "/" }]);
}

/** The live label links as `label name → item ids`. */
export async function linkedTo(labelName: string): Promise<string[]> {
  const label = (await labelNamed(labelName))!;
  return (await store().labels.listLinks(RETAIL))
    .filter((k) => k.deleted_at === null && k.label_id === label.id)
    .map((k) => (k.entity_id ?? k.attribute_id ?? k.mapping_id ?? k.source_table_id ?? k.source_column_id)!);
}

/** The cards of a canvas as `[element id, live level, row filter]`. */
export async function liveCards(canvasId: string): Promise<[string, string | null, string][]> {
  return (await store().canvasItems.listOfCanvas(RETAIL, canvasId)).map((i) => [(i.entity_id ?? i.source_table_id)!, i.live_level, i.row_filter]);
}

/** The change events of the newest change group in the data file. */
export async function lastGroup() {
  const events = await store().changeEvents.list(RETAIL);
  const last = events[events.length - 1]!;
  return events.filter((e) => e.change_group_id === last.change_group_id);
}

/** Waits until the canvas shows a card with this name (a fresh page after a write). */
export const expectCard = (page: Page, name: string, count = 1) => expect(page.locator("[data-card]").filter({ has: page.getByTestId("card-name").filter({ hasText: new RegExp(`^${name}$`) }) })).toHaveCount(count);
