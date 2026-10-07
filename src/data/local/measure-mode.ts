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
