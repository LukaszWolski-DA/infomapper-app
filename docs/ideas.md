# Ideas

Ideas that came up while building a slice and are not part of its PRD (AD-25). Each one needs a decision before it
is built.

## Settings: keep the typed value on a stale-version conflict (slice 0, step 5b)

Today, when a save is refused because someone else changed the record meanwhile ("Someone changed this meanwhile.
Reload to see the latest version."), the field goes back to the last value this page saved, and the typed value is
lost. Better: keep the user's typed value in the field and show the current server value next to it, so the user can
choose which to keep (or copy parts of theirs) instead of retyping.

## Mapping by drag: from the attribute side too, and auto-pan near the edge (slice 1b, step 2)

The prototype also starts a mapping drag from an attribute row and drops it on a column row, and it scrolls the
canvas by itself while a mapping (or a card) is dragged near the edge of the view. The slice 1b PRD asks only for a
column dragged onto an attribute or an entity's header, so neither is built. Both would help on large canvases, where
the column and the attribute are often not in view at the same time.
