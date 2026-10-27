import { describe, expect, it } from "vitest";
import { ids } from "./__fixtures__/domain";
import { safeReturnPath } from "./return-path";

const ours = new Set([ids.ws]);
const page = (path: string) => safeReturnPath(path, ours);

describe("safeReturnPath (slice 8, F14)", () => {
  it("returns to a page of one of the organization's workspaces", () => {
    expect(page(`/w/${ids.ws}`)).toBe(`/w/${ids.ws}`);
    expect(page(`/w/${ids.ws}/p/${ids.projectA}`)).toBe(`/w/${ids.ws}/p/${ids.projectA}`);
    expect(page(`/w/${ids.ws}/p/${ids.projectA}/c/${ids.canvas1}`)).toBe(`/w/${ids.ws}/p/${ids.projectA}/c/${ids.canvas1}`);
    expect(page(`/w/${ids.ws}/p/${ids.projectA}?map=${ids.mapEmail}`)).toBe(`/w/${ids.ws}/p/${ids.projectA}?map=${ids.mapEmail}`);
  });

  it("refuses another organization's workspace", () => {
    expect(page(`/w/${ids.otherOrg}`)).toBeNull();
  });

  it("refuses anything that could leave the app or the workspace's pages", () => {
    for (const next of [
      null,
      undefined,
      "",
      "https://evil.example",
      "//evil.example",
      `//evil.example/w/${ids.ws}`,
      `/\\evil.example`,
      `/w/${ids.ws}/../../evil`,
      `/w/${ids.ws}/%2F%2Fevil.example`,
      `/w/${ids.ws}?next=https://evil.example`,
      `/w/${ids.ws}/x/${ids.projectA}`,
      `/w/${ids.ws}/c/${ids.canvas1}`,
      `/w/${ids.ws}#frag`,
      `/W/${ids.ws}`,
      `/w/${"-".repeat(36)}`,
      "/sign-in",
    ]) {
      expect(page(next as string)).toBeNull();
    }
  });
});
