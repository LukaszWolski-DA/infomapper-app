"use client";

// Test hooks of the canvas page (slice 4p): only where the server allows them (`areTestHooksOn`: the e2e dev server and
// the measurement-only build). Renders nothing.
//
//   window.__imFade({ focus: "<entity id>" })     Focus on an entity
//   window.__imFade({ focus: { t: "requirement", id: "<requirement id>" } })   Focus on a requirement (slice 4b-1)
//   window.__imFade(null)                         no fading
//   window.__imCoverageLod("tint" | "dot")        item 19's variant below 40 % (slice 4b-1, for the screenshots)
//   window.__imIndexTiming("page" | "synthetic")  times 30 builds of the requirement index in the browser, on the page's
//                                                 data or on slice 4a's synthetic model (item 10); resolves to the figures

import { useEffect, useState } from "react";
import { buildRequirementIndex } from "@/domain/model/requirement-index";
import type { ScopeModel } from "@/domain/model/requirements";
import type { Requirement, RequirementLink } from "@/domain/types";
import { lodVariant, type LodVariant } from "./coverage-colours";
import { requestFade, type FadeRequest } from "./fade";

/** The page's requirements and model, for timing the index (the same objects the inspector gets). */
export interface IndexData {
  model: ScopeModel;
  requirements: readonly Requirement[];
  requirementLinks: readonly RequirementLink[];
}

/** Times `builds` builds of the requirement index after three warm-up builds (slice 4p, item 10). */
async function timeIndex(which: "page" | "synthetic", data: IndexData | undefined, builds = 30) {
  const input =
    which === "synthetic"
      ? (await import("@/domain/model/requirement-index-synthetic")).syntheticIndexInput()
      : data
        ? { requirements: [...data.requirements], links: [...data.requirementLinks], model: data.model }
        : null;
  if (!input) return { error: "no data on this page" };
  for (let i = 0; i < 3; i++) buildRequirementIndex(input.requirements, input.links, input.model);
  const times: number[] = [];
  for (let i = 0; i < builds; i++) {
    const t = performance.now();
    buildRequirementIndex(input.requirements, input.links, input.model);
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  const r = (v: number) => +v.toFixed(2);
  return {
    which,
    requirements: input.requirements.length,
    attributes: input.model.attributes.length,
    mappings: input.model.mappings.length,
    links: input.links.length,
    builds,
    medianMs: r(times[Math.floor(builds / 2)]!),
    minMs: r(times[0]!),
    maxMs: r(times[builds - 1]!),
  };
}

export function TestHooks({ indexData }: { indexData?: IndexData }) {
  useEffect(() => {
    const w = window as unknown as { __imFade?: (r: FadeRequest) => void; __imIndexTiming?: (which: "page" | "synthetic") => Promise<unknown>; __imCoverageLod?: (v: LodVariant) => void };
    w.__imFade = requestFade;
    w.__imCoverageLod = (v) => lodVariant.set(v);
    w.__imIndexTiming = (which) => timeIndex(which, indexData);
    return () => {
      delete w.__imFade;
      delete w.__imIndexTiming;
      requestFade(null);
    };
  }, [indexData]);
  return null;
}

/**
 * Inside the canvas's error boundary (slice 4p, item 8, S4P-09): `window.__imCanvasThrow()` makes the next render throw,
 * so a spec can check the boundary. Only where the test hooks are on; a fresh mount (Reload) does not throw again.
 */
export function CanvasThrowHook() {
  const [thrown, setThrown] = useState(false);
  useEffect(() => {
    const w = window as unknown as { __imCanvasThrow?: () => void };
    w.__imCanvasThrow = () => setThrown(true);
    return () => {
      delete w.__imCanvasThrow;
    };
  }, []);
  if (thrown) throw new Error("A test error in the canvas (S4P-09).");
  return null;
}
