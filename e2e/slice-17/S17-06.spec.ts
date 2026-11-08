// S17-06 (slice 17, item 2c, D-72): a drag from REQ-104's card handle onto Customer's customer_id row links it, one undo
// step, and the card has not moved; onto Customer's header links the entity; onto a dimension's row on the Sales star
// links; onto empty canvas nothing is linked; Escape links nothing. A drag from the card's name still moves it. No
// handle for a reviewer or a reader.

import { removeFromCanvas } from "../../src/domain/commands/canvas-item";
import { asLukasz, RETAIL, store } from "../slice-01b/helpers";
import { test as starTest } from "../slice-15a/fixtures";
import { expect, test, type Page } from "./fixtures";
import {
  canvasUrl,
  dragOnto,
  emptySpot,
  entityIdOf,
  expectToast,
  headOf,
  ids,
  loadModel,
  openCanvas,
  placeReqCards,
  reqCard,
  reqCardData,
  row,
  signInAs,
  STAR,
  STAR_VIEW,
  starUrl,
  tracesOf,
  undoButton,
  WHOLE_CO,
} from "./helpers";

// the seed has REQ-104's card on Customer & orders, beside the Sales cards (slice 4b-2), where the Overview and the toasts
// lie over it in this view: it is moved up, into the empty space right of Customer, as test data
const VIEW = WHOLE_CO;
async function moveReq104Up(): Promise<void> {
  const card = (await reqCardData("REQ-104"))!;
  const canvas = await store().canvases.get(RETAIL, card.canvas_id);
  await asLukasz((ctx, access) => removeFromCanvas(ctx, access, { item: card, canvas }, { canvasItemId: card.id, expectedVersion: card.version }));
  await placeReqCards([{ key: "REQ-104", x: 1176, y: 120 }]);
}
/** The Overview's miniature lies over REQ-104's card in this view: hidden (M, as its button). */
async function hideOverview(page: Page) {
  if (await page.locator(".overview-view").count()) await page.keyboard.press("m");
  await expect(page.locator(".overview-view")).toHaveCount(0);
}
const linkHandle = (page: Page, key = "REQ-104") => reqCard(page, key).getByTestId("handle-requirement-link");

test("S17-06: a drag from the handle onto a row links the attribute, one undo step; onto a header the entity; the card stays", async ({ page }) => {
  const { attribute, entity } = await ids();
  const customerId = attribute("Customer", "customer_id");
  await moveReq104Up();
  const at0 = await reqCardData("REQ-104");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), VIEW);
  await hideOverview(page);
  await expect(linkHandle(page)).toHaveAttribute("title", "Drag onto an attribute, entity, mapping, table or column to link REQ-104");

  // onto the row: the line and the target are shown while dragging
  await dragOnto(page, linkHandle(page), row(page, "Customer", customerId.id), { release: false });
  await expect(page.getByTestId("layer-link-drag")).toBeVisible();
  await expect(page.getByTestId("mark-drop-target")).toHaveAttribute("data-target", customerId.id);
  await expect(page.getByTestId("hint-drop")).toHaveText("Link to customer_id");
  await page.mouse.up();
  await expectToast(page, "Linked REQ-104 to customer_id.");
  await expect.poll(() => tracesOf("REQ-104")).toContain(customerId.id);
  await expect(page.getByTestId("layer-link-drag")).toHaveCount(0);
  const at1 = await reqCardData("REQ-104");
  expect([at1!.x, at1!.y]).toEqual([at0!.x, at0!.y]);

  // one undo step
  await undoButton(page).click();
  await expectToast(page, "Undone: Link requirement");
  await expect.poll(() => tracesOf("REQ-104")).not.toContain(customerId.id);

  // onto Customer's header: the entity
  await dragOnto(page, linkHandle(page), headOf(page, "Customer"));
  await expect.poll(() => tracesOf("REQ-104")).toContain(entity("Customer").id);
});

test("S17-06: onto empty canvas or after Escape nothing is linked; the card's name still moves it", async ({ page }) => {
  await moveReq104Up();
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), VIEW);
  await hideOverview(page);
  const traces = await tracesOf("REQ-104");
  const spot = await emptySpot(page);
  await dragOnto(page, linkHandle(page), spot);
  await expectToast(page, "Drop REQ-104 on an attribute, entity, mapping, table or column to link it.");
  expect(await tracesOf("REQ-104")).toEqual(traces);

  const { attribute } = await ids();
  await dragOnto(page, linkHandle(page), row(page, "Customer", attribute("Customer", "email").id), { release: false });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("layer-link-drag")).toHaveCount(0);
  await page.mouse.up();
  expect(await tracesOf("REQ-104")).toEqual(traces);

  // a drag from the name moves the card
  const at0 = await reqCardData("REQ-104");
  const name = (await reqCard(page, "REQ-104").getByTestId("card-name").boundingBox())!;
  await dragOnto(page, reqCard(page, "REQ-104").getByTestId("card-name"), { x: name.x - 160, y: name.y - 160 });
  await expect.poll(async () => { const at = (await reqCardData("REQ-104"))!; return [at.x, at.y]; }).not.toEqual([at0!.x, at0!.y]);
  expect(await tracesOf("REQ-104")).toEqual(traces);
});

test("S17-06: no handle for a reviewer or a reader", async ({ page }) => {
  for (const who of ["Piotr Wiśniewski", "Kasia Zielińska"] as const) {
    await signInAs(page, who);
    await openCanvas(page, canvasUrl(), VIEW);
  await hideOverview(page);
    await expect(reqCard(page, "REQ-104")).toBeVisible();
    await expect(linkHandle(page)).toHaveCount(0);
  }
});

starTest("S17-06: onto a dimension's row on the Sales star", async ({ page }) => {
  const dim = entityIdOf("cust");
  const city = (await loadModel()).attributes.find((a) => a.entity_id === dim && a.name === "city")!;
  await placeReqCards([{ key: "REQ-104", x: 1400, y: 40 }], STAR);
  await signInAs(page, "Łukasz");
  await openCanvas(page, starUrl(), STAR_VIEW);
  await dragOnto(page, linkHandle(page), row(page, "Dim Customer", city.id));
  await expect.poll(() => tracesOf("REQ-104")).toContain(city.id);
});
