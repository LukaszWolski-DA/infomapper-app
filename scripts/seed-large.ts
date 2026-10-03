// npm run seed:large: adds the workspace “Performance test” (the canvas spike's data set) to .data/dev-db.json
// (or INFOMAPPER_DEV_DB), seeding the demo data first if the file does not exist yet.
import { devDbPath } from "../src/data/local/file";
import { seedLargeData } from "../src/data/local/dev-data";

const file = devDbPath();
seedLargeData(file).then(
  (result) => {
    console.log(result === "created" ? `Added the workspace "Performance test" to ${file}.` : `${file} has "Performance test" already; nothing changed.`);
  },
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  },
);
