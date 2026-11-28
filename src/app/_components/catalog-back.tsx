"use client";

// "← Back to InfoCatalog" in InfoMapper's navigation row (slice 39, S39-05, C7; the prototype's `#pfBack`): after "Open
// in InfoMapper", back to the same search, scope, kind tab and item, while the page shown is of the workspace it opened.
// Read from the tab's `sessionStorage` once the page runs (`src/ui/catalog-return.ts`), so the server's HTML has none;
// a page of another workspace ends it.

import Link from "next/link";
import { useEffect, useState } from "react";
import { filterChipVariants } from "@/ui/components/chip";
import { dropCatalogReturn, readCatalogReturn } from "@/ui/catalog-return";
import { cn } from "@/ui/lib/utils";

export function CatalogBack({ workspaceId }: { workspaceId: string }) {
  const [path, setPath] = useState<string | null>(null);
  useEffect(() => {
    const kept = readCatalogReturn(window.sessionStorage);
    if (kept && kept.workspaceId !== workspaceId) dropCatalogReturn(window.sessionStorage);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the tab's storage exists only in the browser
    setPath(kept && kept.workspaceId === workspaceId ? kept.path : null);
  }, [workspaceId]);
  if (!path) return null;
  return (
    <Link
      href={path}
      data-testid="button-back-to-catalog"
      title="Back to InfoCatalog, to the search you came from"
      className={cn(filterChipVariants({ on: true }), "ml-1 mr-1.5 flex-none px-[9px] text-xs")}
    >
      ← Back to InfoCatalog
    </Link>
  );
}
