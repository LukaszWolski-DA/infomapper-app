import { expect, test } from "./fixtures";
import {
  canvasUrl,
  card,
  dragCardBy,
  expectToast,
  frameEl,
  frameNamed,
  headPoint,
  item,
  key,
  loadModel,
  makeFrame,
  namePoint,
  openCanvas,
  shiftClick,
  signInAs,
  FRAMED,
  zoomOf,
} from "./helpers";

const conceptOf = async (entityName: string) => {
  const model = await loadModel();
  const e = model.entities.find((x) => x.name === entityName)!;
  return model.concepts.find((c) => c.id === e.concept_id)!.name;
};

test("S2B-03: setting the frame to Concept “Sales” marks Customer as misplaced (chip and “Doesn't belong here”); “Move to Sales” moves it in the model; dropping an entity of another concept into a concept frame asks; “Keep” leaves it marked; a group drop asks once", async ({ page }) => {
  const area = await makeFrame({ x: 472, y: 0, width: 304, height: 856 }, { name: "Area" }); // Customer and Sales Order
  const customers = await makeFrame({ x: 880, y: 0, width: 600, height: 480 }, { name: "Customers", concept: "Customer" }); // empty
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  const zoom = await zoomOf(page);
  const misplacedChip = frameEl(page, "Area").getByTestId("frame-chip").filter({ hasText: "misplaced" });

  // the frame panel: Concept, then Sales; a typed name is kept
  const at = await namePoint(page, "Area");
  await page.mouse.click(at.x, at.y);
  await expect(page.getByTestId("panel-frame")).toBeVisible();
  await page.getByTestId("seg-frame-kind").getByRole("button", { name: "Concept" }).click();
  await expect(page.getByTestId("select-frame-concept")).toBeVisible();
  await page.getByTestId("select-frame-concept").selectOption({ label: "Sales" });
  await expect.poll(async () => (await frameNamed("Area"))?.kind).toBe("concept");
  const sales = (await loadModel()).concepts.find((c) => c.name === "Sales")!;
  await expect.poll(async () => (await frameNamed("Area"))?.concept_id).toBe(sales.id);
  await expect(misplacedChip).toHaveText("1 misplaced");
  await expect(page.getByTestId("frame-misplaced")).toHaveCount(1);
  await expect(page.getByTestId("frame-misplaced")).toContainText("Customer");
  await expect(page.getByTestId("frame-misplaced")).toContainText("is in Customer");
  expect(await conceptOf("Customer")).toBe("Customer"); // changing what the frame stands for changes no model

  // “Move to Sales” moves Customer in the model; the mark goes; Ctrl+Z brings both back
  await page.getByTestId("button-frame-move-entity").click();
  await expect.poll(() => conceptOf("Customer")).toBe("Sales");
  await expect(misplacedChip).toHaveCount(0);
  await key(page, "Control+z");
  await expect.poll(() => conceptOf("Customer")).toBe("Customer");
  await expect(misplacedChip).toHaveText("1 misplaced");

  // into a frame of its own concept: no question
  await dragCardBy(page, "Customer", 408 * zoom, 40 * zoom);
  await expect.poll(async () => (await item("Customer")).frame_id).toBe(customers);
  await expect(page.getByTestId("dialog-concept-question")).toHaveCount(0);
  // back into the Sales frame: the question; “Keep” leaves it marked as misplaced
  await dragCardBy(page, "Customer", -408 * zoom, -40 * zoom);
  const question = page.getByTestId("dialog-concept-question");
  await expect(question).toBeVisible();
  await expect(page.getByTestId("text-concept-question")).toHaveText(
    "Customer is now inside the Sales frame, but belongs to the Customer concept. Move it to Sales in the model?",
  );
  await expect(page.getByTestId("button-concept-move")).toHaveText("Move to Sales");
  await expect(page.getByTestId("button-concept-keep")).toHaveText("Keep in Customer");
  await page.getByTestId("button-concept-keep").click();
  await expectToast(page, "Customer stays in Customer. The frame marks it as outside this concept.");
  await expect.poll(async () => (await item("Customer")).frame_id).toBe(area);
  expect(await conceptOf("Customer")).toBe("Customer");
  await expect(misplacedChip).toHaveText("1 misplaced");

  // a group drop: Sales Order and Order Line (Sales) into the Customer concept frame ask once for both
  const soBefore = await item("Sales Order"), olBefore = await item("Order Line");
  await card(page, "Sales Order").getByTestId("card-name").click();
  await shiftClick(page, await headPoint(page, "Order Line"));
  await expect(page.getByTestId("selection-count")).toHaveText("2 items selected");
  await dragCardBy(page, "Sales Order", 408 * zoom, -528 * zoom);
  await expect(question).toHaveCount(1);
  await expect(page.getByTestId("text-concept-question")).toHaveText(
    /^2 entities \((Sales Order, Order Line|Order Line, Sales Order)\) landed in the Customer frame\. Move them to Customer in the model\?$/,
  );
  await page.getByTestId("button-concept-move").click();
  await expect(question).toHaveCount(0);
  await expectToast(page, "Moved 2 entities to Customer.");
  await expect.poll(() => conceptOf("Sales Order")).toBe("Customer");
  expect(await conceptOf("Order Line")).toBe("Customer");
  expect((await item("Sales Order")).frame_id).toBe(customers);
  expect((await item("Order Line")).frame_id).toBe(customers);
  await page.waitForTimeout(500);
  await expect(question).toHaveCount(0); // asked once
  // the drop and the answer are one change: one Ctrl+Z puts both back
  await key(page, "Control+z");
  await expect.poll(() => conceptOf("Sales Order")).toBe("Sales");
  expect(await conceptOf("Order Line")).toBe("Sales");
  expect(await item("Sales Order")).toMatchObject({ x: soBefore.x, y: soBefore.y, frame_id: area });
  expect(await item("Order Line")).toMatchObject({ x: olBefore.x, y: olBefore.y, frame_id: null });
});
