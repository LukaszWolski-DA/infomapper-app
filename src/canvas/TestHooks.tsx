"use client";

// Test hooks of the canvas page (slice 4p): only where the server allows them (`areTestHooksOn`: the e2e dev server and
// the measurement-only build). Renders nothing.
//
//   window.__imFade({ focus: "<entity id>" })     Focus on an entity
//   window.__imFade({ lens: "<requirement id>" }) the lens of a requirement
//   window.__imFade(null)                         no fading
//   window.__imHoverFade("off" | "plain" | "layer") the hover line fade variant (trial A)

import { useEffect } from "react";
import { requestFade, type FadeRequest } from "./fade";
import { hoverFadeMode, type HoverFadeMode } from "./HoverVeil";

export function TestHooks() {
  useEffect(() => {
    const w = window as unknown as { __imFade?: (r: FadeRequest) => void; __imHoverFade?: (m: HoverFadeMode) => void };
    w.__imFade = requestFade;
    w.__imHoverFade = hoverFadeMode.set;
    return () => {
      delete w.__imFade;
      delete w.__imHoverFade;
      requestFade(null);
      hoverFadeMode.set("off");
    };
  }, []);
  return null;
}
