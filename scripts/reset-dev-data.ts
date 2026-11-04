// npm run reset-dev-data: wipes .data/dev-db.json (or INFOMAPPER_DEV_DB) and seeds it again.
import { addModuleDemoData } from "../src/compose/seed";
import { devDbPath } from "../src/data/local/file";
import { resetDevData } from "../src/data/local/dev-data";

const file = devDbPath();
resetDevData(file, addModuleDemoData).then(
  () => console.log(`Reset ${file} to the demo data.`),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  },
);
