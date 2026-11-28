import { describe, expect, it } from "vitest"
import { CATALOG_RETURN_KEY, dropCatalogReturn, keepCatalogReturn, readCatalogReturn, safeCatalogPath } from "./catalog-return"

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
}

describe("the way back to InfoCatalog (slice 39, S39-05, C7)", () => {
  it("takes only the catalog's own address", () => {
    expect(safeCatalogPath("/catalog")).toBe("/catalog")
    expect(safeCatalogPath("/catalog?org=a&q=x&item=entity%3Aa%3Ab")).toBe("/catalog?org=a&q=x&item=entity%3Aa%3Ab")
    for (const bad of ["https://evil.example/catalog", "//evil.example/catalog", "/catalogue", "/w/x", "/catalog#x", "/catalog?x=//y", 7, null]) expect(safeCatalogPath(bad), String(bad)).toBeNull()
  })

  it("keeps, reads and drops it; an edited value reads as none", () => {
    const s = memory()
    keepCatalogReturn(s, { path: "/catalog?org=a", workspaceId: "w" })
    expect(readCatalogReturn(s)).toEqual({ path: "/catalog?org=a", workspaceId: "w" })
    s.m.set(CATALOG_RETURN_KEY, JSON.stringify({ path: "https://evil.example", workspaceId: "w" }))
    expect(readCatalogReturn(s)).toBeNull()
    s.m.set(CATALOG_RETURN_KEY, "{not json")
    expect(readCatalogReturn(s)).toBeNull()
    keepCatalogReturn(s, { path: "/elsewhere", workspaceId: "w" })
    expect(s.m.get(CATALOG_RETURN_KEY)).toBe("{not json")
    dropCatalogReturn(s)
    expect(readCatalogReturn(s)).toBeNull()
  })
})
