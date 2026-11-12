# IBM Plex, hosted with the app

`src/app/layout.tsx` loads these files through `next/font/local` (Serif: `src/app/fonts/plex-serif.ts`, the document page only, slice 25), so no build, start or e2e run fetches fonts from the
network (chore e2e reliability, P3 B: Turbopack's `next/font/google` failed a whole e2e server start on Google's
stylesheet once, `docs/prd/chore-e2e-reliability-acceptance.md`).

The files are IBM's own, **unmodified** (not subset, not converted), from IBM's npm packages, the "complete" WOFF2
fonts (every script the font covers):

| File | Package | SHA-256 |
| --- | --- | --- |
| `IBMPlexSans-Regular.woff2` | `@ibm/plex-sans` 1.1.0, `fonts/complete/woff2/` | `ba711a3085ff9f27440b6b9c4550cfc47c97bf36591d5da958b975bb3add8c1a` |
| `IBMPlexSans-Medium.woff2` | `@ibm/plex-sans` 1.1.0 | `5660f8a658f8bb50dbc005232f885eadffd2bc1c235c4f6fbb63469d1f9cde6d` |
| `IBMPlexSans-SemiBold.woff2` | `@ibm/plex-sans` 1.1.0 | `f78048030eab62e860efa39a0df79e2e5581bf122eb95b9bc42c0b8a4988d205` |
| `IBMPlexMono-Regular.woff2` | `@ibm/plex-mono` 2.5.0, `fonts/complete/woff2/` | `ba204497f16b6d334cee9d1e963a831b73e3a56e1d6300a8489d18df7214b350` |
| `IBMPlexMono-Medium.woff2` | `@ibm/plex-mono` 2.5.0 | `33faf307fa6031fb4062276d7320a6d632de890cbb347576fd80cfa01077bc25` |
| `IBMPlexSerif-Regular.woff2` | `@ibm/plex-serif` 2.0.0, `fonts/complete/woff2/` | `024ebce13cec984b46e350dd85fa7c01105c777e116bfe95f097ad7fa93f39f2` |
| `IBMPlexSerif-Medium.woff2` | `@ibm/plex-serif` 2.0.0 | `f66376aeb33a5b32116558e0de53b76b48531f6388e352aeeb35ad82ea05cfaa` |
| `IBMPlexSerif-Italic.woff2` | `@ibm/plex-serif` 2.0.0 | `ba5feed9ebae36e3b6ae3486052c90f4f42a294fa67a7c9415985175d19c4c82` |

**Licence:** SIL Open Font License 1.1, in `LICENSE.txt` (the packages' `LICENSE.txt`, the same text as Google Fonts'
`OFL.txt` for the three families; Serif's `license.txt` is the same licence). "Plex" is a Reserved Font Name: a modified version (a subset, for example) may not be
called Plex, which is why the files are used as IBM ships them. Replace them only with other unmodified files from IBM
and update this table.
