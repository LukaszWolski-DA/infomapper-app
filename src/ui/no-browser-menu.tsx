"use client";

// Slice 16 (item 7, D-71): one listener on the document cancels the browser's context menu in the app's own surfaces
// (pages, bars, panels, dialogs and menus in portals), except where `keepsBrowserMenu` keeps it. It runs after React's
// handlers (the root is hydrated on the document), so where the app has a menu (the canvas's toolbox) that menu has
// already opened. Mounted once, in the root layout; renders nothing.

import { useEffect } from "react";
import { keepsBrowserMenu } from "./browser-menu";

export function NoBrowserMenu(): null {
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (!e.defaultPrevented && !keepsBrowserMenu(e)) e.preventDefault();
    };
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, []);
  return null;
}
