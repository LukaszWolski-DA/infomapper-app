// "← Back to InfoCatalog" (slice 39, S39-05, C7 as answered): "Open in InfoMapper" keeps the catalog's address (its
// search, scope, kind tab and item) in the tab's `sessionStorage` with the workspace it opened; InfoMapper's navigation
// row shows the way back while the page shown is of that workspace. The address is checked when read back
// (`safeCatalogPath`): only the catalog's own path, never another place. Opening the catalog again, or another
// workspace, ends it.

export const CATALOG_RETURN_KEY = "im-catalog-return"

export interface CatalogReturn {
  readonly path: string
  readonly workspaceId: string
}

/** The catalog's own address and nothing else: `/catalog` or `/catalog?…`, no other host, path or fragment. */
export function safeCatalogPath(path: unknown): string | null {
  if (typeof path !== "string" || path.length > 2000) return null
  return /^\/catalog(\?[^#\\]*)?$/.test(path) && !path.includes("//") ? path : null
}

export function readCatalogReturn(storage: Pick<Storage, "getItem"> | null | undefined): CatalogReturn | null {
  try {
    const raw = storage?.getItem(CATALOG_RETURN_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as { path?: unknown; workspaceId?: unknown }
    const path = safeCatalogPath(value.path)
    return path && typeof value.workspaceId === "string" ? { path, workspaceId: value.workspaceId } : null
  } catch {
    return null
  }
}

export function keepCatalogReturn(storage: Pick<Storage, "setItem"> | null | undefined, value: CatalogReturn): void {
  try {
    if (safeCatalogPath(value.path)) storage?.setItem(CATALOG_RETURN_KEY, JSON.stringify(value))
  } catch {
    // a browser without storage shows no way back
  }
}

export function dropCatalogReturn(storage: Pick<Storage, "removeItem"> | null | undefined): void {
  try {
    storage?.removeItem(CATALOG_RETURN_KEY)
  } catch {
    // nothing to drop
  }
}
