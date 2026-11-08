// Benchmark (slice 4a, step 3; not part of `npm test`, not a gate): building the requirement index on a synthetic model
// of 500 requirements, 5,000 attributes, 2,000 mappings and 3,000 links. Slice 15d (Y7): the same model with 1,000
// dimensional attributes, 1,500 feeds and 300 more links, in the same run; the bar is the median with feeds at most 25 %
// above the median without. Slice 18 (F3): the same model with 500 calculated attributes of two inputs each (inputs of
// the same entity, so coverage and scope recurse); bar: at most +10 % against the run without. Run: npx tsx
// scripts/bench-requirement-index.ts

import { performance } from "node:perf_hooks";
import { buildRequirementIndex } from "../src/domain/model/requirement-index";
import { syntheticIndexInput } from "../src/domain/model/requirement-index-synthetic";
import type { AttributeInput } from "../src/domain/types";

const ROUNDS = 30;
const ms = (v: number) => `${v.toFixed(1)} ms`;

/** Slice 18: 500 attributes calculated from the next two attributes of their entity. */
function withCalculations(input: ReturnType<typeof syntheticIndexInput>) {
  const byEntity = new Map<string, typeof input.model.attributes>();
  for (const a of input.model.attributes) byEntity.set(a.entity_id, [...(byEntity.get(a.entity_id) ?? []), a]);
  const calculated = new Set<string>();
  const attributeInputs: AttributeInput[] = [];
  const at = "2026-11-08T00:00:00.000Z";
  for (const list of byEntity.values()) {
    for (let i = 0; i + 2 < list.length && calculated.size < 500; i += 3) {
      const [a, x, y] = [list[i]!, list[i + 1]!, list[i + 2]!];
      calculated.add(a.id);
      [x, y].forEach((input, k) =>
        attributeInputs.push({ id: `${a.id}:${k}`, workspace_id: a.workspace_id, attribute_id: a.id, input_attribute_id: input.id, sort_order: k, version: 1, created_at: at, created_by: a.created_by, updated_at: at, updated_by: a.created_by, deleted_at: null }),
      );
    }
  }
  return { ...input, model: { ...input.model, attributes: input.model.attributes.map((a) => (calculated.has(a.id) ? { ...a, is_calculated: true } : a)), attributeInputs } };
}

function bench(label: string, feeds: boolean, calculations = false): number {
  const plain = syntheticIndexInput({ feeds });
  const input = calculations ? withCalculations(plain) : plain;
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
const withCalcs = bench("requirement index with 500 calculations (slice 18)", false, true);
console.log(`with calculations / without: ${((withCalcs / without - 1) * 100).toFixed(0)} % (bar: at most +10 %)`);
