// The demo organizations' development password (slice 8, P9, F7). The seed and the format 9 upgrade write this
// precomputed hash, so seeding before every e2e test costs no scrypt; `password.test.ts` checks it against the
// password, so it cannot drift. The password is in the README; it opens only local development data.

export const DEMO_PASSWORD = "demo-pass";
/** `hashWithSalt(DEMO_PASSWORD, Buffer.from("infomapper-demo!"))` with the adapter's parameters. */
export const DEMO_PASSWORD_HASH = "scrypt$15$8$1$aW5mb21hcHBlci1kZW1vIQ$lPSPf1z2N3_x_oStUPZBIIJyE6gBnmhGtkUs-ncpkv0";
