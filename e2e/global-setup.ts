// Fresh seed data before every e2e run, in its own file so it does not touch .data/dev-db.json.
import { resetDevData } from "../src/data/local/dev-data";
import { E2E_DB } from "./config";

export default async function globalSetup() {
  await resetDevData(E2E_DB);
}
