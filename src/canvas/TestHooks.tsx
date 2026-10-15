"use client";

// Test hooks of the canvas page (slice 4p): only where the server allows them (`areTestHooksOn`: the e2e dev server and
// the measurement-only build). Renders nothing.
//
//   window.__imFade({ focus: "<entity id>" })     Focus on an entity
//   window.__imFade({ lens: "<requirement id>" }) the lens of a requirement
//   window.__imFade(null)                         no fading

import { useEffect, useState } from "react";
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
