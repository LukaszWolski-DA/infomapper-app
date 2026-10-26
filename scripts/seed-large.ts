// npm run seed:large: adds the workspace “Performance test” (the canvas spike's data set) to .data/dev-db.json
// (or INFOMAPPER_DEV_DB), seeding the demo data first if the file does not exist yet. With `-- --changes` (slice 7b) also
// an import into each of its systems with changes to resolve on about 10 % of the tables (the Changes view's figure).
import { devDbPath } from "../src/data/local/file";
import { seedLargeData } from "../src/data/local/dev-data";
import { addLargeChanges } from "../src/data/local/seed-large-changes";

const file = devDbPath();
seedLargeData(file).then(
  async (result) => {
    console.log(result === "created" ? `Added the workspace "Performance test" to ${file}.` : `${file} has "Performance test" already; nothing changed.`);
    if (process.argv.includes("--changes")) console.log((await addLargeChanges(file)) ? "Added an import with changes to resolve." : "It has an import already; nothing changed.");
  },
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  },
);
