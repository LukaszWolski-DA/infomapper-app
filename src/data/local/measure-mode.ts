// When the local adapter and the development sign-in may run (AD-29, AD-31). In development always. In a production
// build only as the measurement-only build: started with INFOMAPPER_MEASURE=1 (`npm run measure:start`, which listens
// on 127.0.0.1 only). A normal production build refuses both.

export const MEASURE_ENV = "INFOMAPPER_MEASURE";

/** A production build started for measuring (AD-31). */
export const isMeasurementBuild = (): boolean => process.env.NODE_ENV === "production" && process.env[MEASURE_ENV] === "1";

/** The local adapter and the development sign-in may run: in development, or in the measurement-only build. */
export const isLocalModeAllowed = (): boolean => process.env.NODE_ENV !== "production" || isMeasurementBuild();

/** Hosts the measurement-only build answers: this machine only. */
export const isLocalHost = (host: string | null): boolean => {
  const name = (host ?? "").replace(/:\d+$/, "").toLowerCase();
  return name === "localhost" || name === "127.0.0.1" || name === "[::1]";
};

/**
 * The test hooks (slice 4p: the fading switch for measuring; the canvas error for S4P-09): set only by the e2e dev server
 * (`playwright.config.ts`); the measurement-only build has them too. A normal production build never does, and a plain
 * `npm run dev` neither (slice 2p's rule for test hooks).
 */
export const TEST_HOOKS_ENV = "INFOMAPPER_TEST_HOOKS";

/** Whether the page installs the test hooks: in the e2e dev server, or in the measurement-only build. */
export const areTestHooksOn = (): boolean => isMeasurementBuild() || (process.env.NODE_ENV !== "production" && process.env[TEST_HOOKS_ENV] === "1");
