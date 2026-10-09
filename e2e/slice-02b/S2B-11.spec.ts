import { expect, test } from "./fixtures";
import { canvasUrl, expectToast, item, key, loadFrames, makeFrame, openCanvas, signInAs, FRAMED } from "./helpers";

// The prototype's arrangeLayout: one source frame per system on the left (systems by name, one column), one concept
// frame per concept on the right (concepts in panel order; two columns only above two entities), 32 px padding at the
// sides, 40 above, 32 below, cards 32 px apart, frames 96 px apart, the concepts 240 px right of the widest source
// frame. Card heights on Customer & orders (rounded up to 8): customers 304, order_header 248, order_line 224,
// web_users 176, Customer 280, Order Line 224, Sales Order 248.
const FRAMES = [
  { name: "CRM", kind: "source_system", x: 0, y: 0, width: 320, height: 304 + 72 },
  { name: "ERP", kind: "source_system", x: 0, y: 376 + 96, width: 320, height: 248 + 32 + 224 + 72 },
  { name: "WEB", kind: "source_system", x: 0, y: 472 + 576 + 96, width: 320, height: 176 + 72 },
  { name: "Customer", kind: "concept", x: 320 + 240, y: 0, width: 320, height: 280 + 72 },
  { name: "Sales", kind: "concept", x: 560, y: 352 + 96, width: 320, height: 224 + 32 + 248 + 72 },
];
const CARDS: Record<string, { x: number; y: number; frame: string }> = {
  customers: { x: 32, y: 40, frame: "CRM" },
  order_header: { x: 32, y: 472 + 40, frame: "ERP" },
  order_line: { x: 32, y: 512 + 248 + 32, frame: "ERP" },
  web_users: { x: 32, y: 1144 + 40, frame: "WEB" },
  Customer: { x: 592, y: 40, frame: "Customer" },
  "Order Line": { x: 592, y: 448 + 40, frame: "Sales" }, // by name
  "Sales Order": { x: 592, y: 488 + 224 + 32, frame: "Sales" },
};

test("S2B-11: “Arrange into frames by concept and system” on Customer & orders builds one frame per system and per concept as in the prototype, keeps free frames, and is one undo step", async ({ page }) => {
  const notes = await makeFrame({ x: 1600, y: 0, width: 320, height: 200 }, { name: "Notes" }); // a free frame, empty
  const before = Object.fromEntries(await Promise.all(Object.keys(CARDS).map(async (n) => [n, await item(n)] as const)));

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  await page.getByTestId("button-arrange-frames").click();
  await expectToast(page, "Arranged the canvas into 5 frames. Undo restores your previous layout.");
  await expect.poll(async () => (await loadFrames()).length).toBe(6);

  const frames = await loadFrames();
  expect(frames.find((f) => f.id === notes)).toMatchObject({ name: "Notes", kind: "free", x: 1600, y: 0, width: 320, height: 200 });
  for (const want of FRAMES) expect(frames.find((f) => f.name === want.name && f.id !== notes), want.name).toMatchObject(want);
  for (const [name, want] of Object.entries(CARDS)) {
    const got = await item(name);
    expect(got, name).toMatchObject({ x: want.x, y: want.y });
    expect(got.frame_id, name).toBe(frames.find((f) => f.name === want.frame && f.kind !== "free")!.id);
  }
  await expect(page.getByTestId("frame")).toHaveCount(6);

  // one Ctrl+Z: the built frames go, the free frame stays, every card is back where it was, in no frame
  await key(page, "Control+z");
  await expect.poll(async () => (await loadFrames()).map((f) => f.id)).toEqual([notes]);
  for (const [name, b] of Object.entries(before)) expect(await item(name), name).toMatchObject({ x: b.x, y: b.y, frame_id: null });
  await expect(page.getByTestId("frame")).toHaveCount(1);
});
