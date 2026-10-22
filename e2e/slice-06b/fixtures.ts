// Slice 6b uses slice 0's fixture: the e2e data file is reseeded before every test, and every test starts with an
// empty browser profile (a fresh tab history, no places in sessionStorage).

export { expect, test, type Page } from "../slice-00/fixtures";
