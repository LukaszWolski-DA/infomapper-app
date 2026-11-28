// InfoCatalog's page (slice 39): its bar (the apps button, "InfoCatalog", the organization, the account). Step 5 adds the
// search below it; until then the page holds the bar alone. Reached only with the licence: `/catalog` answers "not found"
// otherwise (`src/app/catalog/page.tsx`).

import { PlatformBar, type PlatformUser } from "@/app/_components/platform-bar";

export function CatalogPage({ user, organization }: { user: PlatformUser; organization: { id: string; name: string } }) {
  return (
    <div className="flex min-h-dvh flex-col bg-im-canvas">
      <PlatformBar
        title={
          <>
            InfoCatalog <small className="ml-1.5 text-xs font-normal text-im-ink-3">{organization.name}</small>
          </>
        }
        user={user}
      />
      <main data-testid="page-catalog" data-organization={organization.id} className="mx-auto w-full max-w-[1100px] px-4 pb-12 pt-6" />
    </div>
  );
}
