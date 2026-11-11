# Fix: S14B-09's flaky wait for a save's answer

Branch `fix/s14b-09-held-save` from `main` (`716499f`). Shared test infrastructure (`e2e/slice-14b/helpers.ts`), so it
goes on its own branch (the slice cycle, 4). No application code changes.

## 1. The failures

S14B-09 (`e2e/slice-14b/S14B-09.spec.ts`) timed out three times in `answerOf` (`docs/known-limitations.md`, the entry
this branch removes): twice "a focused field with typed text asks; once it is saved, nothing" (slice 21's first closing
run, and fix/field-draft-after-undo's local run), once "a save held on its way asks; after its answer, nothing" (PR 54's
first full run, [42919400613](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/42919400613)).

## 2. The cause (not the one proposed)

The proposal was that the leave check (`leaveAsks`: `page.close({ runBeforeUnload: true })`, dismissed) aborts the save
on its way. The traces and the probes say otherwise:

- **The traces** (part 7 of runs 42689189589 and 42919400613): in both, the save's response arrived (status 200) and the
  load then ended `net::ERR_ABORTED`. In the first, the save was sent after the leave check had ended, so nothing was
  on its way during it. The page was right both times: the card showed the new name, no toast.
- **`response.finished()` never resolves for such a load** (Playwright 1.63): the client resolves it on
  `requestfinished` only, not on `requestfailed`. `answerOf` waited for it, so the test waited until its timeout.
- **It happens without the leave check too.** A probe saved an entity's name 25 times per test, six tests: of the
  server-action requests, 13 of 78 ended `ERR_ABORTED` after their response without the leave check, 12 of 78 with it
  (and 2 of 26 each in a second run). S13-09 met the same thing in slice 18, with no leave check (it waits for
  `data-version` since; `slice-18-acceptance.md`).
- **The page cancels nothing itself:** patching `ReadableStream.cancel`, the reader's `cancel` and
  `AbortController.abort` caught no call. With a clone of each action's body read to its end in the page, 0 of 104
  requests ended aborted, and every body was complete (about 183 KB). So the page's own reader (Next.js's Flight client)
  stops reading an action's response once it has the answer, a little before the stream's end, and Chromium cancels the
  rest of the load. The page has everything it uses; InfoMapper's code is not involved, and the app is not at fault.

## 3. The fix

`answerOf` waits until the page's next server action is **over**: `requestfinished`, or `requestfailed` after a
response (a failure without a response throws with its error text). Then, as before, the entity's card shows the name.
Its callers and assertions are unchanged.

**Deterministic check** (a temporary probe, not committed): the page's real alias save, with a fetch wrapper that reads
one chunk of its answer and cancels the rest, so the load ends `POST … net::ERR_ABORTED` after its response every time.
`main`'s `answerOf`: still waiting after 10 s, 3 of 3. The branch's: answered, 3 of 3.

**Who uses the helpers:** `answerOf` only S14B-09. `leaveAsks` only S14B-09; `leaveAsksNothing` S14B-09 and S14B-10.
`e2e/slice-14b/helpers.ts` is re-exported by `e2e/slice-15a/helpers.ts`, which the specs of slices 15a, 15b, 15c, 16,
18, 19, 20 and 24 import (none calls these three). `e2e/slice-12b/S12B-bytes.spec.ts` has its own `answerOf` that reads
`response.body()`; it runs only in the measurement build, outside the normal run, and is left as it is.

## 4. Tests

- S14B-09 ×10 (`--repeat-each 10`, local, 8 tests each): 80 passed, on `main`'s helpers and again on the branch's. The
  flake did not show locally in 10 rounds; the deterministic check above is what shows the difference.
- `e2e/slice-14b` (local, the branch's helpers): its 11 spec files, 19 tests passed (the run's one failure was the
  probe, then still in the folder).
- `npm run lint`, `npm run typecheck`, `npm test` (165 files, 2,089 tests) pass.
- **The full run** (workflow "E2E", `2a8391f`, all eight parts, no retries;
  [42976006163](https://github.com/LukaszWolski-DA/infomapper-app/actions/runs/42976006163), wall-clock 15 min 47 s):
  **739 passed, 0 failed, 4 skipped, 0 flaky, 0 expected failures.** No server restarted (one server process per part).

  | Part | Time | Heap peak (limit 8,039 MB) |
  | --- | --- | --- |
  | 1 | 7.0 min | 1,032 MB |
  | 2 | 8.4 min | 1,347 MB |
  | 3 | 9.8 min | 1,081 MB |
  | 4 | 8.1 min | 1,121 MB |
  | 5 | 8.9 min | 1,691 MB |
  | 6 | 7.9 min | 1,620 MB |
  | 7 | 9.3 min | 1,299 MB |
  | 8 | 14.7 min | 1,217 MB |

  Part times are the jobs' times on the runner (server start included).
