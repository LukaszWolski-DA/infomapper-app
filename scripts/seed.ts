// npm run seed: creates the demo data in .data/dev-db.json (or INFOMAPPER_DEV_DB) if it does not exist yet.
import { devDbPath } from "../src/data/local/file";
import { seedDevData } from "../src/data/local/dev-data";

const file = devDbPath();
seedDevData(file).then(
  (result) => {
    console.log(result === "created" ? `Seeded ${file}.` : `${file} exists already; nothing changed. Use "npm run reset-dev-data" to start over.`);
  },
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  },
);
