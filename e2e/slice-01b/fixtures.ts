// Slice 1b uses slice 0's fixture: the e2e data file is reseeded before every test, so each test starts from the
// demo model and no test depends on another. The undo history lives in the server's memory; steps whose change group
// is no longer in the reseeded data are left out, so every test also starts with an empty history.

export { expect, test, type Page } from "../slice-00/fixtures";
