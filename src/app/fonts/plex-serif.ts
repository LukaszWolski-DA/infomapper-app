// IBM Plex Serif for generated documents (slice 25, F28): IBM's own unmodified files, hosted with the app as Sans and
// Mono are (no build or start fetches fonts; `ibm-plex/README.md`), loaded by the document page only. The weights are
// the prototype's: Regular, Medium and Italic.

import localFont from "next/font/local";

export const plexSerif = localFont({
  variable: "--font-plex-serif",
  src: [
    { path: "./ibm-plex/IBMPlexSerif-Regular.woff2", weight: "400", style: "normal" },
    { path: "./ibm-plex/IBMPlexSerif-Medium.woff2", weight: "500", style: "normal" },
    { path: "./ibm-plex/IBMPlexSerif-Italic.woff2", weight: "400", style: "italic" },
  ],
});
