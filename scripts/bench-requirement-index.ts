// Benchmark (slice 4a, step 3; not part of `npm test`, not a gate): building the requirement index on a synthetic model
// of 500 requirements, 5,000 attributes, 2,000 mappings and 3,000 links. Slice 15d (Y7): the same model with 1,000
// dimensional attributes, 1,500 feeds and 300 more links, in the same run; the bar is the median with feeds at most 25 %
// above the median without. Run: npx tsx scripts/bench-requirement-index.ts

import { performance } from "node:perf_hooks";
import { buildRequirementIndex } from "../src/domain/model/requirement-index";
import { syntheticIndexInput } from "../src/domain/model/requirement-index-synthetic";

const ROUNDS = 30;
const ms = (v: number) => `${v.toFixed(1)} ms`;

function bench(label: string, feeds: boolean): number {
  const input = syntheticIndexInput({ feeds });
  const build = () => buildRequirementIndex(input.requirements, input.links, input.model, feeds ? input.feeds : undefined);
  build(); // warm-up
  const times: number[] = [];
  let sample = build();
  for (let i = 0; i < ROUNDS; i++) {
    const t = performance.now();
    sample = build();
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(ROUNDS / 2)]!;
  const feedCount = Object.values(input.feeds).reduce((n, list) => n + list.length, 0);
  console.log(
    `${label}: ${input.requirements.length} requirements, ${input.model.attributes.length} attributes, ${input.model.mappings.length} mappings, ${feedCount} feeds, ${input.links.length} links, ${ROUNDS} builds`,
  );
  console.log(`  median ${ms(median)}, fastest ${ms(times[0]!)}, slowest ${ms(times[ROUNDS - 1]!)}; covered ${sample.coveredCount} of ${sample.requirements.length}`);
  return median;
}

const without = bench("requirement index", false);
const withFeeds = bench("requirement index with feeds (slice 15d)", true);
console.log(`with feeds / without: ${((withFeeds / without - 1) * 100).toFixed(0)} % (bar: at most +25 %)`);
