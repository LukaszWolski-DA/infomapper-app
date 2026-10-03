import { describe, expect, it } from "vitest";
import { idsFromPath, parseLastProjects, rememberProject } from "./preferences";

const ws = "01a0f9e9-2007-7148-89de-52f53405ecb8";
const ws2 = "01a0f9e9-2009-7078-b8aa-c0fce61fd49f";
const p1 = "01a0f9e9-200a-75e0-914a-30a0f6049ccd";
const p2 = "01a0f9e9-200b-72a8-81ce-88743c8c4c61";
const c1 = "01a0f9e9-200e-76a0-bc7b-08c5483e9b28";

describe("navigation preferences", () => {
  it("reads workspace and project ids from app paths", () => {
    expect(idsFromPath(`/w/${ws}`)).toEqual({ workspaceId: ws, projectId: null });
    expect(idsFromPath(`/w/${ws}/p/${p1}`)).toEqual({ workspaceId: ws, projectId: p1 });
    expect(idsFromPath(`/w/${ws}/p/${p1}/c/${c1}`)).toEqual({ workspaceId: ws, projectId: p1 });
    expect(idsFromPath("/sign-in")).toEqual({ workspaceId: null, projectId: null });
    expect(idsFromPath("/w/not-an-id/p/x")).toEqual({ workspaceId: null, projectId: null });
  });

  it("remembers the last project per workspace", () => {
    let value = rememberProject(undefined, ws, p1);
    value = rememberProject(value, ws2, p2);
    value = rememberProject(value, ws, p2);
    expect(parseLastProjects(value)).toEqual({ [ws]: p2, [ws2]: p2 });
  });

  it("ignores malformed cookie values", () => {
    expect(parseLastProjects("not json")).toEqual({});
    expect(parseLastProjects(JSON.stringify({ [ws]: "x", y: p1 }))).toEqual({});
    expect(parseLastProjects(JSON.stringify([1, 2]))).toEqual({});
  });
});
