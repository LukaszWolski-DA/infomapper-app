"use client";

// Test hooks of the canvas page (slice 4p): only where the server allows them (`areTestHooksOn`: the e2e dev server and
// the measurement-only build). Renders nothing.
//
//   window.__imFade({ focus: "<entity id>" })     Focus on an entity
//   window.__imFade({ lens: "<requirement id>" }) the lens of a requirement
//   window.__imFade(null)                         no fading

import { useEffect } from "react";
import { requestFade, type FadeRequest } from "./fade";

export function TestHooks() {
  useEffect(() => {
    const w = window as unknown as { __imFade?: (r: FadeRequest) => void };
    w.__imFade = requestFade;
    return () => {
      delete w.__imFade;
      requestFade(null);
    };
  }, []);
  return null;
}
