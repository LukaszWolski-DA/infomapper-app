// Slice 37 (S37-02): the shared controls' variants (src/ui/components). Each role and size gives the design system's
// classes on the tokens; no variant falls back to a local value.
import { describe, expect, it } from "vitest";
import { buttonVariants, BUTTON_LAYOUT } from "@/ui/components/button";
import { cardVariants } from "@/ui/components/card";
import { chipVariants, filterChipVariants, linkChipVariants } from "@/ui/components/chip";
import { DISCLOSURE_HEADER } from "@/ui/components/disclosure";
import { cn } from "@/ui/lib/utils";
import { FIELD_LABEL, FIELD_HINT } from "@/ui/components/field";
import { iconButtonVariants } from "@/ui/components/icon-button";
import { MENU_CONTENT, MENU_HEAD, MENU_ITEM, MENU_LABEL } from "@/ui/components/menu";
import { FIELD_LOOK, inputVariants, textareaVariants } from "@/ui/components/input";
import { SEGMENTED_BUTTON, SEGMENTED_TRACK } from "@/ui/components/segmented";
import { selectVariants } from "@/ui/components/select";
import { tabsListVariants, tabVariants } from "@/ui/components/tabs";
import { buttonClass, dangerClass, inputClass, primaryClass, smallButtonClass } from "@/app/_panels/fields";

const has = (classes: string, ...expected: string[]) => {
  const set = new Set(classes.split(/\s+/));
  for (const c of expected) expect(set, `${c} in "${classes}"`).toContain(c);
};
const lacks = (classes: string, ...unexpected: RegExp[]) => {
  for (const re of unexpected) expect(classes.split(/\s+/).filter((c) => re.test(c)), `${re} in "${classes}"`).toEqual([]);
};

describe("Button", () => {
  it("has one shape: radius 8, an edge, disabled at 45 %, the accent's focus outline", () => {
    has(buttonVariants(), "rounded-md", "border", "disabled:opacity-45", "focus-visible:outline-im-logical");
  });
  it("defaults to secondary, 32 px", () => {
    has(buttonVariants(), "border-im-line", "bg-im-surface", "text-im-ink", "h-control-md", "text-body");
  });
  it.each([
    ["primary", ["border-im-logical", "bg-im-logical", "text-im-on-accent"]],
    ["secondary", ["border-im-line", "bg-im-surface", "text-im-ink"]],
    ["quiet", ["border-transparent", "bg-transparent", "text-im-ink-2"]],
    ["danger", ["border-im-line", "bg-im-surface", "text-im-warn"]],
  ] as const)("role %s", (variant, classes) => has(buttonVariants({ variant }), ...classes));
  it.each([
    ["md", "h-control-md"],
    ["sm", "h-control-sm"],
    ["bar", "h-control-bar"],
    ["xs", "h-target"],
  ] as const)("size %s", (size, height) => has(buttonVariants({ size }), height));
  it("is the look alone: no display or alignment, which the component adds", () => {
    lacks(buttonVariants(), /^(inline-)?flex$/, /^justify-/, /^items-/);
    has(BUTTON_LAYOUT, "inline-flex", "items-center", "justify-center");
  });
});

describe("IconButton", () => {
  it("is 28 px in panels and toolbars, 24 px in a dense row; no edge or fill until hovered", () => {
    has(iconButtonVariants(), "size-control-sm", "border-transparent", "bg-transparent", "enabled:hover:bg-im-hover");
    has(iconButtonVariants({ size: "xs" }), "size-target");
  });
});

describe("fields", () => {
  it("share the 3:1 edge, radius 8, the focus ring, read only on panel", () => {
    has(FIELD_LOOK, "border-im-line-control", "rounded-md", "focus:border-im-logical", "focus:ring-3", "focus:ring-im-logical-soft", "read-only:bg-im-panel", "disabled:opacity-45");
  });
  it("Input: md 32 px, sm 28 px, as a minimum so a text area drawn with it grows", () => {
    has(inputVariants(), "min-h-control-md");
    has(inputVariants({ size: "sm" }), "min-h-control-sm");
    has(textareaVariants(), "resize-y", "border-im-line-control");
  });
  it("Select: md 32, sm 28, bar 30, with the fields' focus ring and disabled look", () => {
    has(selectVariants(), "h-control-md", "focus:ring-3", "disabled:opacity-45", "border-im-line-control");
    has(selectVariants({ size: "sm" }), "h-control-sm");
    has(selectVariants({ size: "bar" }), "h-control-bar");
  });
  it("the label is 12/16 500 in ink-2 (F10); the hint 12/16 in ink-3", () => {
    has(FIELD_LABEL, "text-small", "font-medium", "text-im-ink-2");
    has(FIELD_HINT, "text-small", "text-im-ink-3");
  });
});

describe("Segmented, Tabs, Chip, Card", () => {
  it("Segmented: the track on hover, the chosen one white (aria-pressed)", () => {
    has(SEGMENTED_TRACK, "bg-im-hover", "rounded-md");
    has(SEGMENTED_BUTTON, "min-h-6", "aria-pressed:bg-im-surface", "aria-pressed:text-im-ink");
  });
  it("Tabs: natural width, room between them, the selected one underlined in the accent", () => {
    has(tabsListVariants(), "gap-5", "overflow-x-auto");
    has(tabsListVariants({ density: "panel" }), "gap-3.5");
    has(tabVariants(), "flex-none", "aria-selected:shadow-[inset_0_-2px_0_var(--im-logical)]");
    lacks(tabVariants(), /^flex-1$/);
  });
  it("Chip: a mark 22 px, radius 4, in a tone that means something; the filter chip a 28 px pill", () => {
    has(chipVariants(), "h-[22px]", "rounded-sm", "bg-im-hover");
    has(chipVariants({ tone: "pii" }), "bg-im-warn-soft", "text-im-warn");
    has(chipVariants({ tone: "ok" }), "bg-im-map-soft", "text-im-map");
    has(filterChipVariants({ on: true }), "h-control-sm", "rounded-full", "border-im-logical");
    has(filterChipVariants({ on: true, tone: "physical" }), "border-im-physical", "bg-im-physical-soft", "text-im-physical");
    lacks(filterChipVariants({ on: false, tone: "physical" }), /physical/);
  });
  it("the link chip in a sentence: 24 px for its target, its line kept by the negative margin", () => {
    has(linkChipVariants(), "min-h-target", "-my-[3px]", "bg-im-logical-soft");
    has(linkChipVariants({ tone: "physical" }), "bg-im-physical-soft");
  });
  it("a fold's header is at least 28 px", () => has(DISCLOSURE_HEADER, "min-h-control-sm", "w-full"));
  it("Card: a hairline, radius 12, no shadow; quiet on panel", () => {
    has(cardVariants(), "rounded-lg", "border-im-line", "bg-im-surface");
    lacks(cardVariants(), /^shadow/);
    has(cardVariants({ tone: "quiet" }), "bg-im-panel");
  });
});

describe("cn knows the design system's scales", () => {
  it("a size of the type scale does not drop a text colour, and the control sizes merge", () => {
    expect(cn("text-im-ink text-body", "text-small")).toBe("text-im-ink text-small");
    expect(cn("h-control-md", "h-auto")).toBe("h-auto");
    expect(cn("size-target", "size-control-sm")).toBe("size-control-sm");
  });
  it("a component merged with no class of its own keeps every class", () => {
    const v = buttonVariants({ variant: "secondary", size: "sm" });
    expect(cn(v)).toBe(v);
    const sel = selectVariants();
    expect(cn(sel)).toBe(sel);
  });
});

describe("fields.tsx' constants re-export the components' look", () => {
  it("buttons and fields", () => {
    expect(buttonClass).toBe(buttonVariants({ variant: "secondary", size: "md" }));
    expect(smallButtonClass).toBe(buttonVariants({ variant: "secondary", size: "sm" }));
    expect(dangerClass).toBe(buttonVariants({ variant: "danger", size: "md" }));
    expect(primaryClass).toBe(buttonVariants({ variant: "primary", size: "md" }));
    expect(inputClass).toBe(inputVariants({ size: "md" }));
  });
});

describe("the menus' look (step 3b)", () => {
  it("a pop-over is radius 12 with a hairline and the pop shadow; an item is radius 8, at least 28 px, in body text", () => {
    has(MENU_CONTENT, "rounded-lg", "border", "border-im-line", "shadow-pop", "text-body");
    has(MENU_ITEM, "rounded-md", "min-h-control-sm", "hover:bg-im-hover", "data-[highlighted]:bg-im-hover");
    has(MENU_LABEL, "text-small", "text-im-ink-3");
    has(MENU_HEAD, "text-label", "uppercase");
  });
  it("an item's own padding and gap replace the shared ones", () => {
    const merged = cn(MENU_ITEM, "justify-between gap-4 py-1");
    has(merged, "gap-4", "py-1", "justify-between");
    expect(merged.split(/\s+/)).not.toContain("gap-2");
    expect(merged.split(/\s+/)).not.toContain("py-[7px]");
  });
});

describe("the top bar's pieces (step 4)", () => {
  it("a tool button is the bar's 30 px, no edge, pressed in its tone; its padding is the caller's", async () => {
    const { toolButtonVariants } = await import("@/ui/components/tool-button");
    has(toolButtonVariants(), "h-control-bar", "rounded-md", "aria-pressed:bg-im-logical-soft");
    has(toolButtonVariants({ tone: "warn" }), "aria-pressed:bg-im-warn-soft", "aria-pressed:text-im-warn");
    has(toolButtonVariants({ tone: "plain" }), "aria-pressed:text-im-ink");
    expect(toolButtonVariants().split(/\s+/).some((c) => /^p[xl]?-/.test(c))).toBe(false);
    expect(toolButtonVariants().split(/\s+/)).not.toContain("border");
  });
  it("the bar's segmented switch has no gap between its buttons (widths kept, F15)", async () => {
    const { SEGMENTED_BAR_BUTTON, SEGMENTED_BAR_TRACK } = await import("@/ui/components/segmented");
    expect(SEGMENTED_BAR_TRACK.split(/\s+/).some((c) => c.startsWith("gap-"))).toBe(false);
    has(SEGMENTED_BAR_BUTTON, "h-[26px]", "px-2.5", "aria-pressed:bg-im-surface");
  });
  it("the quiet field shows an edge only when focused", async () => {
    const { QUIET_FIELD } = await import("@/ui/components/input");
    has(QUIET_FIELD, "h-control-sm", "bg-transparent", "focus:bg-im-surface");
    expect(QUIET_FIELD.split(/\s+/)).not.toContain("border");
  });
});

describe("the check box (step 6)", () => {
  it("its label is a 24 px target", async () => {
    const { CHECK_LABEL } = await import("@/ui/components/check");
    has(CHECK_LABEL, "min-h-target", "items-center");
  });
});
