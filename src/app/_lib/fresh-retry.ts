// A write that loses a race on a row the person did not pick a version of runs again on fresh data (slice 4a). Creating
// a requirement raises the workspace's key counter: the browser sends no workspace version for it, so when two people
// create one at the same moment, the second write finds the counter changed and is built again from what is stored now
// (the next free key). A real conflict on a row the person did read keeps its stale-version refusal; only callers that
// ask for it retry. With the database (AD-31) the counter can be raised inside the transaction instead.

export const FRESH_RETRIES = 3;

/** Runs `attempt` until it is not stale, at most `tries` times; returns the last outcome. */
export async function retryWhenStale<R>(attempt: () => Promise<R>, isStale: (outcome: R) => boolean, tries = FRESH_RETRIES): Promise<R> {
  let outcome = await attempt();
  for (let i = 1; i < tries && isStale(outcome); i++) outcome = await attempt();
  return outcome;
}
