import { describe, expect, it } from "vitest";
import { lineNeedsClip, rowNeedsClip, titleNeedsClip } from "./text-fit";

const row = { name: "email", type: "String(100)", pk: false, fk: false, pii: false, bk: false, mappings: 1 };

describe("which names need a clip (S1A-14)", () => {
  it("leaves short names unclipped", () => {
    expect(rowNeedsClip(row, "ent", false)).toBe(false);
    expect(rowNeedsClip({ ...row, name: "cust_id", type: "int" }, "src", false)).toBe(false);
    expect(titleNeedsClip("Customer", "ent", "7/8")).toBe(false);
    expect(lineNeedsClip(["Object", "in Customer"], "ent")).toBe(false);
  });

  it("clips names that may not fit beside the type", () => {
    expect(rowNeedsClip({ ...row, name: "customer_preferred_contact_channel_code" }, "ent", false)).toBe(true);
    expect(rowNeedsClip({ ...row, name: "registration_ip_address_v6", type: "varchar(45)" }, "src", false)).toBe(true);
    expect(titleNeedsClip("Customer Loyalty Programme Membership History", "ent", "0/12")).toBe(true);
    expect(lineNeedsClip(["CRM / crmprod_reporting_replica.dbo_archive_2019"], "src")).toBe(true);
  });

  it("counts badges, dual keys, the mapping count and the card width", () => {
    const edge = { ...row, name: "customer_numb" };
    expect(rowNeedsClip(edge, "ent", false)).toBe(false);
    expect(rowNeedsClip({ ...edge, pii: true, bk: true }, "ent", false)).toBe(true);
    expect(rowNeedsClip(edge, "ent", true)).toBe(true); // PK and FK side by side need a wider key column
    expect(rowNeedsClip({ ...edge, name: "customer_number_and_more", mappings: 12 }, "ent", false, 400)).toBe(false);
  });

  it("counts wide letters wider", () => {
    expect(rowNeedsClip({ ...row, name: "iiiiiiiiiiiiiiiiiiii" }, "ent", false)).toBe(false);
    expect(rowNeedsClip({ ...row, name: "MMMMMMMMMMMMMMMMMMMM" }, "ent", false)).toBe(true);
  });
});
