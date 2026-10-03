# Ideas

Ideas that came up while building a slice and are not part of its PRD (AD-25). Each one needs a decision before it
is built.

## Settings: keep the typed value on a stale-version conflict (slice 0, step 5b)

Today, when a save is refused because someone else changed the record meanwhile ("Someone changed this meanwhile.
Reload to see the latest version."), the field goes back to the last value this page saved, and the typed value is
lost. Better: keep the user's typed value in the field and show the current server value next to it, so the user can
choose which to keep (or copy parts of theirs) instead of retyping.
