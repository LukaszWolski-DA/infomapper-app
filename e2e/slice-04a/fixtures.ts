// Slice 4a uses slice 0's fixture: the e2e data file is reseeded before every test, so each test starts from the demo
// data with its five requirements (REQ-101 to REQ-105, key counter 106) and no test depends on another.

export { expect, test, type Page } from "../slice-00/fixtures";
