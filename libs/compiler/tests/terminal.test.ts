import { afterEach, expect, test, vi } from "vitest";
import { colorEnabled, groupDiagnostics, paint, progress, suggestion, summary } from "../terminal.ts";

afterEach(() => vi.useRealTimers());
test("color follows TTY and FORCE_COLOR; NO_COLOR and CI keep output plain", () => {
  expect(colorEnabled({ isTTY: true }, {})).toBe(true);
  expect(colorEnabled({}, {})).toBe(false);
  expect(paint("red", "error", { write() {}, isTTY: true }, {})).toContain("\x1b[");
  expect(paint("red", "error", { write() {} }, { FORCE_COLOR: "1" })).toContain("\x1b[");
  for (const env of [{ NO_COLOR: "", FORCE_COLOR: "1" }, { CI: "1", FORCE_COLOR: "1" }, { FORCE_COLOR: "0" }]) {
    expect(paint("red", "error", { write() {}, isTTY: true }, env)).toBe("error");
  }
});
test("suggestions reject unrelated words; warnings group by code and file without losing occurrences", () => {
  expect(suggestion("--formt", ["--format", "--quiet"])).toBe(" Did you mean --format?");
  expect(suggestion("unknown", ["sync", "mcp"])).toBe("");
  const a = { code: "RV2104", severity: "warning", filename: "a.tsx", line: 1 };
  const groups = groupDiagnostics([a, { ...a, line: 5 }, { ...a, filename: "b.tsx" }, { ...a, severity: "error" }, { ...a, severity: "error" }]);
  expect(groups.map((g) => g.count)).toEqual([2, 1, 1, 1]);
  expect(groups[0]!.occurrences.map((d) => d.line)).toEqual([1, 5]);
  expect(summary(2, 5)).toBe("2 errors, 5 warnings");
});
test("progress rewrites a TTY, stays periodic and plain in CI, and clears timers on stop", () => {
  vi.useFakeTimers();
  for (const [isTTY, env, ansi] of [
    [true, {}, true],
    [false, {}, false],
    [true, { CI: "1" }, false],
    [true, { NO_COLOR: "1" }, false],
  ] as const) {
    let text = "";
    const task = progress("render", {
      stream: {
        isTTY,
        write(value) {
          text += value;
        },
      },
      env,
    });
    task.update("[12] /docs/x");
    vi.advanceTimersByTime(5000);
    task.stop("prerendered 12 pages");
    const finished = text;
    vi.advanceTimersByTime(10000);
    expect(text).toBe(finished);
    expect(text.includes("\x1b[")).toBe(ansi);
    expect(text).toContain("[12] /docs/x");
    expect(text).toMatch(/prerendered 12 pages in [\d.]+ s\n$/);
  }
  let text = "";
  const task = progress("silent", {
    quiet: true,
    stream: {
      write(value) {
        text += value;
      },
    },
  });
  task.stop("done");
  expect(text).toBe("");
  expect(vi.getTimerCount()).toBe(0);
});
