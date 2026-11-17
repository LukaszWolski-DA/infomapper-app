"use client";

// A test hook on every page (fix/write-after-reseed): only where the server allows test hooks (`areTestHooksOn`: the e2e
// dev server and the measurement-only build). Renders nothing.
//
//   window.__imSavesOnTheWay()   how many saves the page has on their way (leave-guard's `track`: the save chain and the
//                                canvas's queue); the e2e fixtures wait for 0 before a page closes and the next reseed

import { useEffect } from "react";
import { savesOnTheWay } from "./leave-guard";

export function SaveHook() {
  useEffect(() => {
    const w = window as unknown as { __imSavesOnTheWay?: () => number };
    w.__imSavesOnTheWay = savesOnTheWay;
    return () => {
      if (w.__imSavesOnTheWay === savesOnTheWay) delete w.__imSavesOnTheWay;
    };
  }, []);
  return null;
}
