import { expect, test } from "./fixtures";
import {
  callActionDirectly,
  captureActionId,
  card,
  CO,
  DEMO_NOTES,
  dragBetween,
  emptySpot,
  item,
  key,
  labelNamed,
  labelsField,
  loadLabels,
  loadLinks,
  loadNotes,
  loadPins,
  newSession,
  noteEl,
  notePoint,
  noteWithText,
  openCanvas,
  RETAIL,
  SEED_IDS,
  shiftClick,
  toolboxAt,
  typeLabel,
  canvasUrl,
  WHOLE_CO,
} from "./helpers";
import type { Page } from "./fixtures";

const VIEW = { x: -450, y: 0, zoom: 0.5 };
const HOME = `/w/${RETAIL}/p/${SEED_IDS.projOrderManagement}`;
/** Everything the direct calls could change: labels, links, pins and notes. */
const snapshot = async () => ({ labels: await loadLabels(), links: await loadLinks(), pins: await loadPins(), notes: await loadNotes() });
const menuItem = (page: Page, name: string) => page.getByTestId("menu-toolbox").getByRole("menuitem", { name });
const click = async (page: Page, at: { x: number; y: number }) => page.mouse.click(at.x, at.y);

test("S3A-13: as Piotr (reviewer) notes can be written and labels only read; as Kasia (reader) both only read; nothing else is offered, and the commands called directly are refused and change nothing", async ({ browser }) => {
  test.setTimeout(240_000);

  // Łukasz (owner) uses each label and note write once, so its action id can be called again directly
  const owner = await newSession(browser, "Łukasz");
  const o = owner.page;
  await openCanvas(o, canvasUrl(), VIEW);
  await card(o, "order_line").getByTestId("card-name").click();
  await typeLabel(o, "OWNER-1");
  const ids: Record<string, string> = {};
  ids.addLabel = await captureActionId(o, () => o.keyboard.press("Enter"));
  await expect(labelsField(o).getByTestId("chip-label")).toHaveCount(1);
  ids.removeLabel = await captureActionId(o, () => labelsField(o).getByTestId("button-label-remove").click());
  await expect(labelsField(o).getByTestId("chip-label")).toHaveCount(0);
  await typeLabel(o, "OWNER-2");
  await o.keyboard.press("Enter");
  await labelsField(o).getByTestId("button-label-open").click();
  const name = o.getByTestId("input-label-name");
  await name.fill("OWNER-3");
  ids.renameLabel = await captureActionId(o, () => name.press("Enter"));
  await expect.poll(async () => (await labelNamed("OWNER-3")) !== undefined).toBe(true);
  ids.deleteLabel = await captureActionId(o, () => o.getByTestId("button-label-delete").click());
  await expect.poll(async () => (await labelNamed("OWNER-3")) ?? null).toBeNull();
  await key(o, "Escape");
  // notes: create, resolve (update), move, move several, unpin, pin, delete
  await key(o, "n");
  const spot = await emptySpot(o);
  await click(o, spot);
  await o.keyboard.type("Owner note");
  ids.createNote = await captureActionId(o, () => o.keyboard.press("Control+Enter"));
  await expect.poll(async () => (await noteWithText("Owner note")) !== undefined).toBe(true);
  ids.updateNote = await captureActionId(o, () => noteEl(o, DEMO_NOTES.free).getByTestId("button-note-resolve").click());
  const p = await notePoint(o, DEMO_NOTES.free);
  ids.moveNote = await captureActionId(o, () => dragBetween(o, p, { x: p.x + 16, y: p.y + 16 }));
  await click(o, await notePoint(o, DEMO_NOTES.free));
  await shiftClick(o, await notePoint(o, "Owner note"));
  ids.moveNotes = await captureActionId(o, () => o.keyboard.press("ArrowRight"));
  await key(o, "Escape");
  await toolboxAt(o, await notePoint(o, DEMO_NOTES.pinned));
  ids.unpinNote = await captureActionId(o, () => menuItem(o, "Unpin (make it a free note)").click());
  await expect.poll(async () => (await noteWithText(DEMO_NOTES.pinned))!.pin_canvas_item_id).toBeNull();
  await click(o, await notePoint(o, DEMO_NOTES.pinned));
  ids.pinNote = await captureActionId(o, () => o.getByTestId("select-note-pin").selectOption({ label: "order_line" }).then(() => undefined));
  await expect.poll(async () => (await noteWithText(DEMO_NOTES.pinned))!.pin_canvas_item_id).not.toBeNull();
  await click(o, await notePoint(o, "Owner note"));
  ids.deleteNote = await captureActionId(o, () => key(o, "Delete"));
  await expect.poll(async () => (await noteWithText("Owner note")) ?? null).toBeNull();
  // the project home's pin
  await o.goto(HOME);
  ids.pinLabel = await captureActionId(o, () => o.getByTestId("item-project-label").filter({ hasText: "JIRA-481" }).getByTestId("button-label-pin").click());
  await expect.poll(async () => (await loadPins()).length).toBe(1);
  await owner.context.close();

  /** Every label and note write, called directly with arguments that would work for an editor. */
  const callAll = async (page: Page) => {
    const jira = (await labelNamed("JIRA-481"))!;
    const link = (await loadLinks()).find((k) => k.label_id === jira.id)!;
    const free = (await noteWithText(DEMO_NOTES.free))!, pinned = (await noteWithText(DEMO_NOTES.pinned))!;
    const customers = await item("customers");
    const ref = (n: typeof free) => ({ noteId: n.id, expectedVersion: n.version });
    return {
      labels: [
        await callActionDirectly(page, ids.addLabel!, [RETAIL, { target: { kind: "entity", id: (await item("Customer")).entity_id }, name: "SNEAKY" }]),
        await callActionDirectly(page, ids.removeLabel!, [RETAIL, { labelLinkId: link.id, expectedVersion: link.version }]),
        await callActionDirectly(page, ids.renameLabel!, [RETAIL, { labelId: jira.id, expectedVersion: jira.version, name: "SNEAKY" }]),
        await callActionDirectly(page, ids.deleteLabel!, [RETAIL, { labelId: jira.id, expectedVersion: jira.version }]),
        await callActionDirectly(page, ids.pinLabel!, [RETAIL, { projectId: SEED_IDS.projOrderManagement, labelId: jira.id, pinned: false }]),
      ],
      notes: [
        await callActionDirectly(page, ids.createNote!, [RETAIL, CO, { text: "Sneaky", x: 0, y: 0 }]),
        await callActionDirectly(page, ids.updateNote!, [RETAIL, { ...ref(free), status: "open" }]),
        await callActionDirectly(page, ids.moveNote!, [RETAIL, { ...ref(free), x: free.x + 80, y: free.y }]),
        await callActionDirectly(page, ids.moveNotes!, [RETAIL, CO, { notes: [{ ...ref(free), x: free.x + 80, y: free.y }] }]),
        await callActionDirectly(page, ids.unpinNote!, [RETAIL, ref(pinned)]),
        await callActionDirectly(page, ids.pinNote!, [RETAIL, { ...ref(free), pin: { canvasItemId: customers.id } }]),
        await callActionDirectly(page, ids.deleteNote!, [RETAIL, ref(free)]),
      ],
    };
  };

  // ---- Piotr (reviewer): notes yes, labels read-only ----
  const piotr = await newSession(browser, "Piotr Wiśniewski");
  const pp = piotr.page;
  await openCanvas(pp, canvasUrl(), WHOLE_CO);
  await card(pp, "customers").getByTestId("card-name").click();
  await expect(labelsField(pp).getByTestId("chip-label")).toHaveCount(1);
  await expect(labelsField(pp).getByTestId("input-label")).toHaveCount(0);
  await expect(labelsField(pp).getByTestId("button-label-remove")).toHaveCount(0);
  await labelsField(pp).getByTestId("button-label-open").click();
  await expect(pp.getByTestId("input-label-name")).toHaveAttribute("readonly", "");
  await expect(pp.getByTestId("button-label-delete")).toHaveCount(0);
  // he writes a note with the Note tool
  await expect(pp.getByTestId("button-tool-note")).toBeVisible();
  await key(pp, "n");
  await click(pp, await emptySpot(pp));
  await pp.keyboard.type("Reviewer question");
  await pp.keyboard.press("Control+Enter");
  await expect.poll(async () => (await noteWithText("Reviewer question"))?.created_by).toBe(SEED_IDS.userPiotr);
  // no pin stars on the project home
  await pp.goto(HOME);
  await expect(pp.getByTestId("item-project-label")).toHaveCount(2);
  await expect(pp.getByTestId("button-label-pin")).toHaveCount(0);
  // label commands called directly are refused and change no label, link or pin
  const labelsBefore = { labels: await loadLabels(), links: await loadLinks(), pins: await loadPins() };
  const asPiotr = await callAll(pp);
  for (const reply of asPiotr.labels) expect(reply).toContain("As a reviewer you cannot change labels.");
  expect({ labels: await loadLabels(), links: await loadLinks(), pins: await loadPins() }).toEqual(labelsBefore);
  await piotr.context.close();

  // ---- Kasia (reader): notes and labels read-only ----
  const kasia = await newSession(browser, "Kasia Zielińska");
  const kp = kasia.page;
  await openCanvas(kp, canvasUrl(), VIEW);
  await expect(kp.getByTestId("button-tool-note")).toHaveCount(0);
  await key(kp, "n");
  await expect(kp.getByTestId("area-canvas")).not.toHaveAttribute("data-mode", "note");
  await expect(kp.getByTestId("button-note-resolve")).toHaveCount(0);
  await expect(kp.getByTestId("note-resize")).toHaveCount(0);
  // a right-click on a note opens no toolbox (it would offer nothing), its panel is read-only
  const r = await notePoint(kp, DEMO_NOTES.pinned);
  await kp.mouse.click(r.x, r.y, { button: "right" });
  await expect(kp.getByTestId("panel-note")).toBeVisible();
  await expect(kp.getByTestId("menu-toolbox")).toHaveCount(0);
  await expect(kp.getByTestId("panel-note")).toBeVisible();
  await expect(kp.getByTestId("input-note-panel-text")).toHaveAttribute("readonly", "");
  await expect(kp.getByTestId("button-note-delete")).toHaveCount(0);
  // a card's Notes section: the list, no “Add a note”; no Labels input
  await card(kp, "order_line").getByTestId("card-name").click();
  const ordline = await item("order_line");
  const pinnedHere = (await loadNotes()).filter((n) => n.pin_canvas_item_id === ordline.id).length;
  expect(pinnedHere).toBeGreaterThan(0);
  await expect(kp.getByTestId("section-notes").getByTestId("item-note-here")).toHaveCount(pinnedHere);
  await expect(kp.getByTestId("button-add-note")).toHaveCount(0);
  await expect(labelsField(kp).getByTestId("input-label")).toHaveCount(0);
  // a drag and Delete on a note change nothing
  const before = await snapshot();
  const q = await notePoint(kp, DEMO_NOTES.pinned);
  await dragBetween(kp, q, { x: q.x + 60, y: q.y + 40 });
  await click(kp, q);
  await key(kp, "Delete");
  await kp.waitForTimeout(800);
  expect(await snapshot()).toEqual(before);
  // every label and note command called directly is refused and changes nothing
  const asKasia = await callAll(kp);
  for (const reply of asKasia.labels) expect(reply).toContain("As a reader you cannot change labels.");
  for (const reply of asKasia.notes) expect(reply).toContain("As a reader you cannot change notes.");
  expect(await snapshot()).toEqual(before);
  await kasia.context.close();
});
