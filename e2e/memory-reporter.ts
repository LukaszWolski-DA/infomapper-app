// The tests' side of the e2e memory log (chore e2e reliability, P1; E2E_MEMORY_LOG=1 only, see playwright.config.ts).
// It writes when each test begins and ends to `<E2E_MEMORY_FILE>.tests.jsonl`, the measuring conditions at the start
// and the end (scripts/measure-conditions.ts), and starts scripts/e2e-memory-system.ps1 for the machine's memory. The
// server's own figures come from scripts/e2e-memory-probe.cjs; `scripts/e2e-memory-report.ts` puts the three together.
// Off Windows (GitHub Actions' Linux runners, chore CI e2e) the machine's half is only the available memory, from
// `os.freemem()` (libuv reads Linux's MemAvailable) every 5 s, in the same file and field as the PowerShell script's.

import { spawn, type ChildProcess } from "node:child_process";
import { appendFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import { conditions } from "../scripts/measure-conditions";

export default class MemoryReporter implements Reporter {
  private readonly base = process.env.E2E_MEMORY_FILE;
  private system: ChildProcess | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private n = 0;

  constructor() {
    if (!this.base) return;
    if (process.platform !== "win32") {
      const sample = () => this.append("system", { availableMb: Math.round(os.freemem() / 1024 / 1024), totalMb: Math.round(os.totalmem() / 1024 / 1024) });
      sample();
      this.timer = setInterval(sample, 5_000);
      this.timer.unref();
      return;
    }
    const script = path.resolve("scripts", "e2e-memory-system.ps1");
    this.system = spawn(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-Out", `${this.base}.system.jsonl`, "-Parent", String(process.pid)],
      { stdio: "ignore", windowsHide: true },
    );
  }

  private write(line: object) {
    this.append("tests", line);
  }

  private append(kind: "tests" | "system", line: object) {
    if (!this.base) return;
    try {
      appendFileSync(`${this.base}.${kind}.jsonl`, JSON.stringify({ t: new Date().toISOString(), ...line }) + "\n");
    } catch {
      // a lost line is fine; the run must not fail on its log
    }
  }

  onBegin() {
    this.write({ event: "conditions", at: "begin", ...conditions() });
  }

  onTestBegin(test: TestCase) {
    this.n += 1;
    this.write({ event: "begin", n: this.n, file: path.relative("e2e", test.location.file).replace(/\\/g, "/"), line: test.location.line, title: test.title });
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this.write({ event: "end", n: this.n, status: result.status, ms: result.duration, error: result.error?.message?.split("\n")[0]?.slice(0, 200) });
  }

  onEnd(result: FullResult) {
    this.write({ event: "conditions", at: "end", status: result.status, ...conditions() });
    this.system?.kill();
    if (this.timer) clearInterval(this.timer);
  }

  printsToStdio() {
    return false;
  }
}
