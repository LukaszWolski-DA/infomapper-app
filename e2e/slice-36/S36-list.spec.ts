// Slice 36, Łukasz's acceptance (25 November 2026): B5.1 (a), the Documentation tab's meta line ends with "created
// {yyyy-mm-dd hh:mm}" in the browser's time zone for shared and private documents alike, and documents of the same name
// are listed newest first; the Style panel's switch reads "“Draft” mark" (it works for both sources).
import { test, expect } from "./fixtures";
import type { DocumentDefinition } from "../../src/modules/infodocumenter/domain/types";
import { changeDb, DEMO_BASELINE, docsUrl, documentFromBaseline, formUrl, laidOut, minute, signInAs } from "./helpers";

test.use({ seed: "full" });

const NAME = "Sign-off for Retail Co";
const OLDER = "2026-11-20T09:15:00.000Z";
const NEWER = "2026-11-20T09:16:00.000Z";

test("S36 list: the same name newest first, each with the time it was made; the switch's label", async ({ page }) => {
  const older = await documentFromBaseline(DEMO_BASELINE.id);
  const newer = await documentFromBaseline(DEMO_BASELINE.id);
  // two documents of the same name made a minute apart (fixed times); the older one shared
  await changeDb((db) => {
    for (const d of (db as unknown as { document_definition: DocumentDefinition[] }).document_definition) {
      if (d.id === older) Object.assign(d, { name: NAME, created_at: OLDER, shared: true });
      if (d.id === newer) Object.assign(d, { name: NAME, created_at: NEWER });
    }
  });
  await signInAs(page, "Łukasz");
  await page.goto(docsUrl());

  // the shared one, with its "created" time in the browser's time zone (the e2e run's: Europe/Warsaw)
  const shared = page.getByTestId("list-shared-documents").locator(`[data-testid="row-document"][data-name="${NAME}"]`);
  await expect(shared.getByTestId("text-document-meta")).toContainText(`from baseline “${DEMO_BASELINE.name}”`);
  await expect(shared.getByTestId("text-document-created")).toHaveText(minute(OLDER));
  await expect(shared.getByTestId("text-document-meta")).toHaveText(new RegExp(`· by Łukasz · created ${minute(OLDER)}$`));

  // a private one too; and with both private, the newer above the older
  const mine = page.getByTestId("list-private-documents").locator(`[data-testid="row-document"][data-name="${NAME}"]`);
  await expect(mine.getByTestId("text-document-created")).toHaveText(minute(NEWER));
  await changeDb((db) => {
    const d = (db as unknown as { document_definition: DocumentDefinition[] }).document_definition.find((x) => x.id === older)!;
    d.shared = false;
  });
  await page.reload();
  const both = page.getByTestId("list-private-documents").locator(`[data-testid="row-document"][data-name="${NAME}"]`);
  await expect(both).toHaveCount(2);
  // the times are drawn in the browser after hydration (`LocalMinute`): a retrying read, never allTextContents()
  await expect(both.getByTestId("text-document-created")).toHaveText([minute(NEWER), minute(OLDER)]);
  expect(await both.getByTestId("link-document-name").evaluateAll((a) => a.map((x) => x.getAttribute("href")))).toEqual([
    expect.stringContaining(newer),
    expect.stringContaining(older),
  ]);

  // the switch's label in the Style panel
  await page.goto(formUrl(newer));
  await laidOut(page);
  await expect(page.getByTestId("check-style-watermark").locator("xpath=..")).toHaveText("“Draft” mark");
});
