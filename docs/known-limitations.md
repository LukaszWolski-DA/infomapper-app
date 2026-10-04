# Known limitations

Things we know are not fully right yet, accepted for now, with what has to happen later.

## Local data adapter (AD-29)

### "At least one canvas" can race (slice 0)

Removing a canvas from a project is refused when the canvas would belong to no project, or the project would have no
canvas left (D-28). The command checks this against links read just before the write; the local adapter then
re-checks versions, keys and references inside its serialised write, but not this count. Two removals at the same
moment can therefore both pass the check and leave a canvas or project without its last link.

- **Accepted** in the local adapter: it is development only and has one user at a time in practice.
- **Supabase slice:** check this rule in the same transaction as the write (e.g. lock the project's and the canvas's
  `project_canvas` rows, count, then delete), so concurrent removals cannot both succeed.

## Right panel (slice 1a)

### Panel links only reach rows whose card is on this canvas (step 5a)

The canvas selection points at a card (a card, a row of a card, or a line), so the right panel can only show an
attribute or a column whose entity or source table has a card on the open canvas. Links in the panels (the
attribute list of an entity, the source and target of a mapping, “Comes from”) do nothing for attributes and columns
whose card is not here. Mappings open from anywhere, because a mapping is selected by itself.

- **Accepted** by Łukasz for slice 1a.
- **Later:** let the selection name an attribute or a column directly (as the prototype's `attr` and `col`
  selections do), so the panel can show them without a card.

## End-to-end tests (slice 1a, step 6)

### “The destination stream closed early” in the e2e server log

The e2e dev server sometimes prints `⨯ Error: The destination stream closed early.` (digest 2208966200). It was seen
three times in every full run until step 6; two causes were found and fixed: the proxy wrote preference cookies during
server actions, which made Next.js refresh the page after every action, and a navigation right after an action cut
that refresh off (after S0-05, S1A-12, S1A-13). What remains is about once in three full runs, after S0-11, which
clicks through the breadcrumbs quickly: a navigation that starts while the previous page is still streaming. No test
fails on it, and the browser behaves as it should.

- **Accepted:** it is the dev server noting that the browser left a page early.
- **Later:** look again if it shows up outside fast navigation, or in a production build.

### e2e dev servers run without Turbopack's file-system cache

Next.js 16.1+ keeps a cache of the dev compilation in the build folder. The e2e runs stop their dev servers by force,
and a server that reused such a folder answered 404 for whole routes now and then (S0-10, and once a whole run). E2e
servers (`NEXT_DIST_DIR` set) therefore run without that cache, `npm run e2e` starts from an empty `.next-e2e`, and
S0-10 removes `.next-e2e-restart` before and after use. A global setup warms the server up (signs in, opens the main
pages), so the first tests do not wait for compiles.

- **Accepted:** an e2e run compiles every page once (about a minute); `npm run dev` keeps its cache.
- **Later:** if the e2e runs move to a production build once the local adapter is gone (Supabase slice), this goes away.
