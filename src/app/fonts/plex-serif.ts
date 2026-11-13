// IBM Plex Serif for documents (slice 26, step 4: the Formal template), IBM's own files hosted with the app as Sans and
// Mono are (fonts/ibm-plex/README.md). Loaded only by InfoDocumenter's editor and document page, which put its variable
// on their content: the canvas and every other page keep the root layout's fonts and preloads.

import localFont from "next/font/local";

export const plexSerif = localFont({
  variable: "--font-plex-serif",
  src: [
    { path: "./ibm-plex/IBMPlexSerif-Regular.woff2", weight: "400", style: "normal" },
    { path: "./ibm-plex/IBMPlexSerif-Medium.woff2", weight: "500", style: "normal" },
    { path: "./ibm-plex/IBMPlexSerif-Italic.woff2", weight: "400", style: "italic" },
  ],
});
