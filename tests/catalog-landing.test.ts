// The landing zone's words (slice 39, S39-01): the greeting by the hour, the count lines.

import { describe, expect, it } from "vitest";
import { greetingOf } from "@/modules/infocatalog/app/greeting";
import { catalogCount, mapperCount } from "@/modules/infocatalog/app/landing-words";

describe("the landing zone's words", () => {
  it("greets by the hour: morning before 12, afternoon before 18, evening after", () => {
    expect(greetingOf(0, "Łukasz")).toBe("Good morning, Łukasz");
    expect(greetingOf(11, "Łukasz")).toBe("Good morning, Łukasz");
    expect(greetingOf(12, "Anna")).toBe("Good afternoon, Anna");
    expect(greetingOf(17, "Anna")).toBe("Good afternoon, Anna");
    expect(greetingOf(18, "Kasia")).toBe("Good evening, Kasia");
  });

  it("counts in the tiles' words, singular and plural", () => {
    expect(mapperCount(3, "Retail Co – DWH")).toBe("3 workspaces you belong to · last: Retail Co – DWH");
    expect(mapperCount(1, null)).toBe("1 workspace you belong to");
    expect(catalogCount(4871, 2, "InfoMate")).toBe("4,871 items in 2 workspaces of InfoMate");
    expect(catalogCount(1, 1, "KB")).toBe("1 item in 1 workspace of KB");
  });
});
