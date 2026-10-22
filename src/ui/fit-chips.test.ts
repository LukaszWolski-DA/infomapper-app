import { describe, expect, it } from "vitest";
import { fitChips } from "./fit-chips";

const base = { widths: [60, 80, 100], gap: 5, plus: 30, hysteresis: 16 };

describe("fitChips", () => {
  it("shows every chip when they fit, with no “+{n}”", () => {
    expect(fitChips({ ...base, room: 250, shown: 3 })).toBe(3); // 60 + 5 + 80 + 5 + 100
  });

  it("folds from the end as soon as the chips do not fit, making room for “+{n}”", () => {
    expect(fitChips({ ...base, room: 249, shown: 3 })).toBe(2); // 60 + 5 + 80 + 5 + 30 = 180
    expect(fitChips({ ...base, room: 179, shown: 3 })).toBe(1); // 60 + 5 + 30 = 95
    expect(fitChips({ ...base, room: 20, shown: 3 })).toBe(0);
  });

  it("brings a chip back only with the hysteresis to spare", () => {
    expect(fitChips({ ...base, room: 250, shown: 2 })).toBe(2);
    expect(fitChips({ ...base, room: 265, shown: 2 })).toBe(2);
    expect(fitChips({ ...base, room: 266, shown: 2 })).toBe(3);
  });

  it("keeps its count while the room moves within the hysteresis", () => {
    let shown = 3;
    for (const room of [249, 255, 260, 250, 262, 249]) shown = fitChips({ ...base, room, shown });
    expect(shown).toBe(2);
  });

  it("starts from the chips there are when the list shrinks", () => {
    expect(fitChips({ ...base, widths: [60], room: 300, shown: 3 })).toBe(1);
  });
});
