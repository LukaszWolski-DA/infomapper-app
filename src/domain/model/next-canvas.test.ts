import { describe, expect, it } from "vitest";
import type { ChangeEvent, ProjectCanvas } from "../types";
import { canvasAfterStep } from "./next-canvas";

const P = "p1";
const link = (canvas_id: string, sort_order: number, added_at = "2026-10-07T10:00:00Z"): ProjectCanvas => ({
  project_id: P,
  canvas_id,
  workspace_id: "w",
  sort_order,
  added_at,
  added_by: "u",
});
const created = (row: ProjectCanvas): ChangeEvent => ({
  id: "e",
  workspace_id: "w",
  change_group_id: "g",
  occurred_at: row.added_at,
  user_id: "u",
  object_type: "project_canvas",
  object_id: row.canvas_id,
  operation: "create",
  before_image: null,
  after_image: { ...row },
  context_label_id: null,
});

describe("canvasAfterStep (slice 2a)", () => {
  const first = link("a", 0), original = link("b", 1), third = link("c", 2);

  it("keeps the open canvas when it is still in the project", () => {
    expect(canvasAfterStep({ projectId: P, canvasId: "b" }, [first, original, third], [])).toBeNull();
  });

  it("returns to the original after undoing its duplicate while the copy is open (same tab order, earlier tab)", () => {
    const copy = link("copy", 1, "2026-10-07T11:00:00Z");
    expect(canvasAfterStep({ projectId: P, canvasId: "copy" }, [first, original, third], [created(copy)])).toBe("b");
  });

  it("falls back to the project's first canvas when the original is gone, or the step was not a duplicate", () => {
    const copy = link("copy", 1, "2026-10-07T11:00:00Z");
    expect(canvasAfterStep({ projectId: P, canvasId: "copy" }, [first, third], [created(copy)])).toBe("a");
    expect(canvasAfterStep({ projectId: P, canvasId: "gone" }, [first, original], [])).toBe("a");
  });

  it("ignores a duplicate made in another project", () => {
    const elsewhere = { ...link("copy", 1), project_id: "p2" };
    expect(canvasAfterStep({ projectId: P, canvasId: "copy" }, [first, original], [created(elsewhere)])).toBe("a");
  });

  it("has nothing to open when the project has no canvas left", () => {
    expect(canvasAfterStep({ projectId: P, canvasId: "a" }, [], [])).toBeNull();
  });
});
