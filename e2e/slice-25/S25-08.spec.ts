// S25-08 (slice 25, D7, F26): a Polish and a German workspace print headings and labels in their language; names and
// definitions stay as the model has them. "Sales analytics" is the seed's Polish workspace (Retail Co's; Łukasz is a
// guest reviewer there and makes a private document as every member may); "Retail Co – DWH" is set to German.

import { expect, test } from "./fixtures";
import { createDocumentAs, DEMO_DOCUMENT_NAMES, grantDocLicence, laidOut, marginContent, RETAIL, SEED_IDS, setWorkspace, signInAs, storedDocument, unnumbered, viewUrl } from "./helpers";

const texts = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const host = document.querySelector('[data-testid="document-host"]')!;
    return {
      toc: host.querySelector(".dtoc h2")?.textContent,
      sections: [...host.querySelectorAll("h2[id]")].map((h) => h.textContent),
      cover: [...host.querySelectorAll(".dcovt th")].map((t) => t.textContent),
      heads: [...new Set([...host.querySelectorAll("table.dt th")].map((t) => t.textContent))],
      entities: [...host.querySelectorAll("h4")].map((h) => h.textContent),
    };
  });

test("S25-08: a Polish workspace prints its headings and labels in Polish", async ({ page }) => {
  await grantDocLicence(SEED_IDS.orgRetailCo);
  await setWorkspace(SEED_IDS.wsSales, { infodoc: true });
  const { document } = await createDocumentAs(SEED_IDS.userLukasz, "dictionary", SEED_IDS.wsSales);
  // slice 26, step 4: slice 25's look, the sections unnumbered (numbered by default since)
  await unnumbered(document.name);
  await signInAs(page, "Łukasz");
  await page.goto(viewUrl(document.id, SEED_IDS.wsSales));
  await laidOut(page);
  const t = await texts(page);
  expect(t.toc).toBe("Spis treści");
  // slice 26 (D2): the preset's sections, every heading in Polish
  expect(t.sections).toEqual(["Wprowadzenie", "Przegląd modelu", "Konwencje i notacja", "Słownik danych", "Wymagania i pokrycie", "Reguły jakości danych", "Rejestr klasyfikacji"]);
  expect(t.cover).toEqual(["Klient", "Workspace", "Stan modelu", "Wersja", "Status", "Przygotował(a)"]);
  expect(t.heads).toEqual(expect.arrayContaining(["Atrybut", "Typ", "Dane osobowe"]));
  expect(await marginContent(page, 1, "top-center")).toBe('"WERSJA ROBOCZA · model bieżący"');
  expect(await marginContent(page, 1, "bottom-right")).toBe('"Strona " counter(page) " z " counter(pages)');
});

test("S25-08: a German workspace prints its headings and labels in German; names and definitions unchanged", async ({ page }) => {
  await setWorkspace(RETAIL, { doc_language: "de" });
  await signInAs(page, "Łukasz");
  await unnumbered(DEMO_DOCUMENT_NAMES.shared);
  await page.goto(viewUrl((await storedDocument(DEMO_DOCUMENT_NAMES.shared))!.id));
  await laidOut(page);
  const t = await texts(page);
  expect(t.toc).toBe("Inhalt");
  expect(t.sections).toEqual(["Einleitung", "Modellübersicht", "Konventionen und Notation", "Datenkatalog", "Anforderungen und Abdeckung", "Datenqualitätsregeln", "Klassifikationsverzeichnis"]);
  expect(t.cover).toEqual(["Kunde", "Workspace", "Modellstand", "Version", "Status", "Erstellt von"]);
  expect(t.heads).toEqual(expect.arrayContaining(["Attribut", "Typ", "Personenbezogene Daten"]));
  expect(t.entities).toContain("Customer");
  await expect(page.getByTestId("document-host")).toContainText("A person or organisation that buys from us.");
  expect(await marginContent(page, 1, "top-center")).toBe('"ENTWURF · aktuelles Modell"');
  expect(await marginContent(page, 1, "bottom-left")).toMatch(/^"Retail Co – DWH · Aktuelles Modell vom /);
});
