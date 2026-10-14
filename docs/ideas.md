# Ideas

Ideas that came up while building a slice and are not part of its PRD (AD-25). Each one needs a decision before it
is built.

## Settings: keep the typed value on a stale-version conflict (slice 0, step 5b)

Today, when a save is refused because someone else changed the record meanwhile ("Someone changed this meanwhile.
Reload to see the latest version."), the field goes back to the last value this page saved, and the typed value is
lost. Better: keep the user's typed value in the field and show the current server value next to it, so the user can
choose which to keep (or copy parts of theirs) instead of retyping.

## Mapping by drag: from the attribute side too (slice 1b, step 2)

The prototype also starts a mapping drag from an attribute row and drops it on a column row. The slice 1b PRD asks
only for a column dragged onto an attribute or an entity's header, so this is not built. (Auto-scroll near the canvas
edge, mentioned here before, was built in step 2 at Łukasz's request.)

## Feeding sources: drag from the panel onto the canvas (slice 1b, step 5)

In the prototype, a feeding source (or fed entity) in the right panel can also be dragged onto the canvas and lands
where it is dropped. The slice 1b PRD asks for a click (placed beside the card) and “Add the N missing”, so dragging
from the right panel is not built; the left panel's drag onto the canvas works as before.

## “Undo” in more toasts (slice 1b, step 5)

The prototype offers “Undo” in almost every toast after a change (a new mapping, a relationship, cards placed beside
a card). The slice 1b PRD asks for it on destructive actions only (deletes, remove from canvas), so that is what is
built; Ctrl+Z and the top bar's Undo work for every change.

## Undo and redo on the project and workspace home pages (slice 1b, acceptance)

Undo and redo (the top bar's buttons and Ctrl+Z, Ctrl+Shift+Z) are only on canvas pages (assumption 8 in the slice 1b
acceptance). Changes made on the project and workspace home pages (projects, canvases) are in the undo history too,
but can only be undone from a canvas. Better: the same buttons and keys on those home pages as well.

## Entity tool on a collapsed block (slice 2c, step 4)

The Entity tool creates the new entity exactly where clicked, also on a collapsed frame's block, and the new card does
not join that frame (as in the prototype; Łukasz's decision (i) in step 4). Better: the Entity tool on a collapsed
block files the new entity into the frame like a drop, and takes the concept of a concept frame.

## Labels on requirements (after slice 2c)

Labels on requirements: `label_link` gets a `requirement_id` target (a new migration, with the “exactly one target”
check extended to it), and the requirement panel gets a Labels field. D-33 keeps labels and requirements separate today;
decide with the requirements slice (4).

## Notes in the Overview miniature (slice 3a, step 4)

The prototype's miniature (`renderMini`) draws the notes as small rectangles in their paper colour; the Overview in
the bottom-right corner shows none (slice 3a PRD, not listed; Łukasz after step 4). A candidate for slice 3b or the
minimap slice. It needs its own measurement: the miniature is drawn once per change of the cards (S1A-14), and notes
would add to what it draws and to when it draws again.

## The “Newly labeled” frame on live canvases (slice 3b, step 0)

The prototype puts cards that become required on a live canvas into a grey frame “Newly labeled” (`sys: "new"`), made
to the right of the content when missing, grown to fit and removed when empty. Slice 3b leaves it out (Łukasz's answer
to Q3: no migration for a new `frame.kind`): newly required cards land to the right of the existing content, one under
another, in no frame, and the toast lists them. A deviation from the prototype to revisit; it needs `newly_labeled` in
the CHECK on `frame.kind` (or another marker) and a rule so “Arrange into frames” does not rebuild it away.

## “Add to this canvas” on a panel without its card (slice 4a, step 3)

Since slice 4a a go-to link to an element whose card is not on the open canvas opens its panel only. The prototype's
entity and source table panels then offer “Add to this canvas” where “Remove from this canvas” would be. Slice 4a leaves
it out (not in its PRD; Łukasz after step 3); a candidate for slice 4b, which places requirement cards and can place an
element's card from its panel the same way.
