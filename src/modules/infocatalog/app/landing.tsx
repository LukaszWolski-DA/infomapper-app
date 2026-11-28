// The landing zone (slice 39, S39-01, the prototype's `landing()`): after sign-in for a person who reads an
// organization's InfoCatalog. A greeting, the lead line and the two tiles, InfoMapper's and InfoCatalog's, each with its
// three bullets, a count line and its button. Plain data from the page (`src/compose/catalog-pages.tsx`); the texts are
// the PRD's (InfoCatalog's third bullet as agreed on 27 November 2026).

import Link from "next/link";
import type { ReactNode } from "react";
import { PlatformBar, type PlatformUser } from "@/app/_components/platform-bar";
import { buttonVariants } from "@/ui/components/button";
import { cn } from "@/ui/lib/utils";
import { Greeting } from "./greeting";
import { CATALOG_TILE, catalogCount, LANDING_LEAD, LANDING_TITLE, MAPPER_TILE, mapperCount } from "./landing-words";

export interface LandingProps {
  user: PlatformUser;
  firstName: string;
  mapper: { workspaces: number; last: string | null };
  catalog: { organization: string; organizationId: string; items: number; workspaces: number };
}

export function CatalogLanding({ user, firstName, mapper, catalog }: LandingProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-im-canvas">
      <PlatformBar title={LANDING_TITLE} user={user} />
      <main data-testid="page-landing" className="mx-auto w-full max-w-[1040px] px-4 pb-12 pt-9">
        <Greeting firstName={firstName} />
        <p data-testid="text-landing-lead" className="m-0 mb-7 max-w-[62ch] text-im-ink-2">
          {LANDING_LEAD}
        </p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-[18px]">
          <Tile
            testId="tile-infomapper"
            icon={<MapperIcon />}
            iconClass="bg-im-logical-soft text-im-logical"
            name={MAPPER_TILE.name}
            tag={MAPPER_TILE.tag}
            text={MAPPER_TILE.text}
            bullets={MAPPER_TILE.bullets}
            count={mapperCount(mapper.workspaces, mapper.last)}
            href="/?to=workspace"
            button={MAPPER_TILE.button}
            buttonTestId="button-open-infomapper"
          />
          <Tile
            testId="tile-infocatalog"
            icon={<CatalogIcon />}
            iconClass="bg-im-map-soft text-im-map"
            name={CATALOG_TILE.name}
            isNew
            tag={CATALOG_TILE.tag}
            text={CATALOG_TILE.text(catalog.organization)}
            bullets={CATALOG_TILE.bullets}
            count={catalogCount(catalog.items, catalog.workspaces, catalog.organization)}
            href={`/catalog?org=${catalog.organizationId}`}
            button={CATALOG_TILE.button}
            buttonTestId="button-open-infocatalog"
          />
        </div>
      </main>
    </div>
  );
}

function Tile(p: {
  testId: string;
  icon: ReactNode;
  iconClass: string;
  name: string;
  isNew?: boolean;
  tag: string;
  text: string;
  bullets: readonly string[];
  count: string;
  href: string;
  button: string;
  buttonTestId: string;
}) {
  return (
    <section data-testid={p.testId} className="flex flex-col gap-3 rounded-lg border border-im-line bg-im-surface p-[22px]">
      <div className="flex items-center gap-3">
        <i className={cn("grid size-10 flex-none place-items-center rounded-[9px]", p.iconClass)}>{p.icon}</i>
        <div>
          <h2 className="m-0 text-[17px] font-semibold">
            {p.name}
            {p.isNew && <span className="ml-1.5 rounded-sm bg-im-map-soft px-1.5 py-0.5 align-middle text-[11px] font-semibold uppercase tracking-[.04em] text-im-map">New</span>}
          </h2>
          <div className="text-xs text-im-ink-3">{p.tag}</div>
        </div>
      </div>
      <p className="m-0 text-im-ink-2">{p.text}</p>
      <ul className="m-0 grid gap-[3px] pl-[18px] text-im-ink-2">
        {p.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2.5 pt-1.5">
        <span data-testid={`${p.testId}-count`} className="text-xs text-im-ink-3">
          {p.count}
        </span>
        <Link href={p.href} data-testid={p.buttonTestId} className={cn(buttonVariants({ variant: "primary" }), "inline-flex items-center px-3.5 hover:brightness-108")}>
          {p.button}
        </Link>
      </div>
    </section>
  );
}

const MapperIcon = () => (
  <svg viewBox="0 0 24 24" className="size-[22px] fill-none stroke-current stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden>
    <rect x="3" y="4" width="7" height="6" rx="1.5" />
    <rect x="14" y="14" width="7" height="6" rx="1.5" />
    <path d="M10 7h3a2 2 0 012 2v5" />
  </svg>
);

const CatalogIcon = () => (
  <svg viewBox="0 0 24 24" className="size-[22px] fill-none stroke-current stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden>
    <circle cx="10.5" cy="10.5" r="5.5" />
    <path d="M15 15l5 5M8 10.5h5M10.5 8v5" />
  </svg>
);
