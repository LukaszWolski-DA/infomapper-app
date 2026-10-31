import { describe, expect, it } from "vitest";
import { canvas, canvasItem, ids } from "../__fixtures__/domain";
import { canvasMode, cardMode, cardShownNames, exceptionFor, namesControl, shownName } from "./aliases";

const onNames = canvas();
const onAliases = canvas(ids.canvas1, { entity_names: "alias", attribute_names: "alias" });
const customer = { name: "Customer", alias: "Klient" };
const rows = [
  { name: "customer_id", alias: "Numer klienta" },
  { name: "email", alias: null },
];

describe("the canvas's and a card's modes", () => {
  it("reads null as name on the canvas, and a card without an exception follows its canvas", () => {
    expect(canvasMode(onNames, "entity")).toBe("name");
    expect(canvasMode(onAliases, "attribute")).toBe("alias");
    expect(cardMode(canvasItem(), onAliases, "entity")).toBe("alias");
    expect(cardMode(canvasItem(ids.itemCustomer, { entity_names: "name" }), onAliases, "entity")).toBe("name");
    expect(cardMode(canvasItem(ids.itemCustomer, { entity_names: "alias" }), onNames, "attribute")).toBe("name");
  });

  it("stores no exception for a choice equal to the canvas's mode", () => {
    expect(exceptionFor("name", onNames, "entity")).toBeNull();
    expect(exceptionFor("alias", onNames, "entity")).toBe("alias");
    expect(exceptionFor("alias", onAliases, "attribute")).toBeNull();
    expect(exceptionFor("name", onAliases, "attribute")).toBe("name");
    expect(exceptionFor(null, onAliases, "entity")).toBeNull();
  });

  it("the control is mixed while a live card of the canvas has an exception in that dimension", () => {
    const items = [canvasItem(ids.itemCustomer, { entity_names: "alias" }), canvasItem(ids.itemCrmCustomer)];
    expect(namesControl(onNames, items, "entity")).toBe("mixed");
    expect(namesControl(onNames, items, "attribute")).toBe("name");
    expect(namesControl(onAliases, items, "attribute")).toBe("alias");
    // a deleted card or a card on another canvas does not count
    expect(namesControl(onNames, [canvasItem(ids.itemCustomer, { entity_names: "alias", deleted_at: "2026-10-02T12:00:00.000Z" })], "entity")).toBe("name");
    expect(namesControl(onNames, [canvasItem(ids.itemCustomer, { entity_names: "alias", canvas_id: ids.canvas2 })], "entity")).toBe("name");
  });
});

describe("the shown text (F8)", () => {
  it("is the alias in alias mode when there is one, otherwise the name", () => {
    expect(shownName(customer, "alias")).toBe("Klient");
    expect(shownName(customer, "name")).toBe("Customer");
    expect(shownName({ name: "Customer", alias: null }, "alias")).toBe("Customer");
    expect(shownName({ name: "Customer", alias: "" }, "alias")).toBe("Customer");
  });

  it("gives a card's header and rows by its own modes, row by row with the name as fallback", () => {
    expect(cardShownNames(canvasItem(), onNames, customer, rows)).toEqual({ header: "Customer", rows: ["customer_id", "email"] });
    expect(cardShownNames(canvasItem(), onAliases, customer, rows)).toEqual({ header: "Klient", rows: ["Numer klienta", "email"] });
    // the two dimensions are independent: an entity exception leaves the rows alone
    expect(cardShownNames(canvasItem(ids.itemCustomer, { entity_names: "alias" }), onNames, customer, rows)).toEqual({ header: "Klient", rows: ["customer_id", "email"] });
    expect(cardShownNames(canvasItem(ids.itemCustomer, { attribute_names: "name" }), onAliases, customer, rows)).toEqual({ header: "Klient", rows: ["customer_id", "email"] });
    expect(cardShownNames(canvasItem(), onAliases, { name: "Customer", alias: null }, [])).toEqual({ header: "Customer", rows: [] });
  });
});
