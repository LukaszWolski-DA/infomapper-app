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
