import { expect, test } from "./fixtures";
import { canvasCommits, canvasUrl, ids, lineMenu, loadModel, mappingLine, openCanvas, settledCommits, signInAs } from "./helpers";

// PRD section 6: a status from a mapping line's menu, in the development build. The save chain changes the version
// sent, not what the canvas draws, so the canvas commits for it are the same before and after step 2b's wiring
// (`window.__imCanvasCommits`, from the settled canvas before the right-click to the settled canvas after the page
// shows the new status). Before the wiring (step 2a's code) it was 4 in three runs out of three.

test("S10A-commits: a status from a mapping line's menu adds as many canvas commits as before the save chain", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  const { attribute } = await ids();
  const mapping = (await loadModel()).mappings.find((m) => m.attribute_id === attribute("Customer", "birth_date").id)!;
  const line = mappingLine(page, mapping.id);
  await expect(line).toHaveCount(1);
  const next = mapping.status === "review" ? "Approved" : "In review";

  const before = await settledCommits(page, canvasCommits);
  expect(before).toBeGreaterThan(0); // the development counter is there
  await lineMenu(page, line, next);
  await expect.poll(async () => (await loadModel()).mappings.find((m) => m.id === mapping.id)?.status).toBe(next === "Approved" ? "approved" : "review");
  await expect(line).toHaveClass(new RegExp(next === "Approved" ? "approved" : "review"));
  const added = (await settledCommits(page, canvasCommits)) - before;
  console.log(`S10A-commits: a status from the line's menu adds ${added} canvas commit(s)`);
  expect(added).toBe(4); // as before the save chain
});
