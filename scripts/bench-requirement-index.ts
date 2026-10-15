// Benchmark (slice 4a, step 3; not part of `npm test`, not a gate): building the requirement index on a synthetic model
// of 500 requirements, 5,000 attributes, 2,000 mappings and 3,000 links. Run: npx tsx scripts/bench-requirement-index.ts

import { performance } from "node:perf_hooks";
import { buildRequirementIndex } from "../src/domain/model/requirement-index";
import { syntheticIndexInput } from "../src/domain/model/requirement-index-synthetic";

const { requirements, links, model } = syntheticIndexInput();
const REQUIREMENTS = requirements.length, ATTRIBUTES = model.attributes.length, MAPPINGS = model.mappings.length, LINKS = links.length;

const ROUNDS = 30;
buildRequirementIndex(requirements, links, model); // warm-up
const times: number[] = [];
let sample = buildRequirementIndex(requirements, links, model);
for (let i = 0; i < ROUNDS; i++) {
  const t = performance.now();
  sample = buildRequirementIndex(requirements, links, model);
  times.push(performance.now() - t);
}
times.sort((a, b) => a - b);
const ms = (v: number) => `${v.toFixed(1)} ms`;
console.log(`requirement index: ${REQUIREMENTS} requirements, ${ATTRIBUTES} attributes, ${MAPPINGS} mappings, ${LINKS} links, ${ROUNDS} builds`);
console.log(`median ${ms(times[Math.floor(ROUNDS / 2)]!)}, fastest ${ms(times[0]!)}, slowest ${ms(times[ROUNDS - 1]!)}; covered ${sample.coveredCount} of ${sample.requirements.length}`);
