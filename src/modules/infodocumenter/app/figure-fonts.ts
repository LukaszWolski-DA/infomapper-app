"use client";

// IBM Plex's files for the figures (slice 27, Q2): the unmodified WOFF2 files the app serves (`src/app/fonts/ibm-plex/`,
// never a subset: "Plex" is a Reserved Font Name), fetched once per page by their bundled URLs and read as base64 to
// embed in each figure's SVG. A face that fails to load is left out (the figure falls back to the system's font and
// says so in the console); nothing about the model is in that message.

import type { FigureFonts } from "../ui/figure-images";

const FILES: Readonly<Record<string, URL>> = {
  "sans-400": new URL("../../../app/fonts/ibm-plex/IBMPlexSans-Regular.woff2", import.meta.url),
  "sans-500": new URL("../../../app/fonts/ibm-plex/IBMPlexSans-Medium.woff2", import.meta.url),
  "sans-600": new URL("../../../app/fonts/ibm-plex/IBMPlexSans-SemiBold.woff2", import.meta.url),
  "mono-400": new URL("../../../app/fonts/ibm-plex/IBMPlexMono-Regular.woff2", import.meta.url),
  "mono-500": new URL("../../../app/fonts/ibm-plex/IBMPlexMono-Medium.woff2", import.meta.url),
};

const base64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

let loading: Promise<FigureFonts> | null = null;

/** The five faces as base64, loaded once per page. */
export function loadFigureFonts(): Promise<FigureFonts> {
  loading ??= Promise.all(
    Object.entries(FILES).map(async ([face, url]) => {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(String(r.status));
        return [face, base64(await r.arrayBuffer())] as const;
      } catch (e) {
        console.warn("A figure font could not be loaded:", face, e instanceof Error ? e.message : e);
        return [face, ""] as const;
      }
    }),
  ).then((entries) => Object.fromEntries(entries.filter(([, v]) => v)));
  return loading;
}
