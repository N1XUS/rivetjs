import { afterEach, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { paint, progress, suggestion } from "../output.ts";
import { main, type MainIO } from "../main.ts";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
function io(cwd: string) {
  const input = new PassThrough(),
    output = new PassThrough(),
    error = new PassThrough();
  let stdout = "",
    stderr = "";
  output.on("data", (data) => (stdout += data));
  error.on("data", (data) => (stderr += data));
  return { input, output, error, cwd, env: { NO_COLOR: "1" }, out: () => stdout, err: () => stderr } satisfies MainIO & { out(): string; err(): string };
}
test("color and progress stay plain on pipes/CI; forced color uses styleText", () => {
  expect(paint("red", "error", { write() {} }, {})).toBe("error");
  expect(paint("red", "error", { write() {} }, { FORCE_COLOR: "1" })).toContain("\x1b[");
  expect(paint("red", "error", { write() {}, isTTY: true }, { NO_COLOR: "", FORCE_COLOR: "1" })).toBe("error");
  expect(paint("red", "error", { write() {}, isTTY: true }, { CI: "1", FORCE_COLOR: "1" })).toBe("error");
  expect(suggestion("--templat", ["--template"])).toContain("Did you mean --template?");
  vi.useFakeTimers();
  for (const isTTY of [true, false]) {
    let output = "";
    const task = progress("install", {
      env: {},
      stream: {
        isTTY,
        write(text) {
          output += text;
        },
      },
    });
    vi.advanceTimersByTime(5000);
    task.stop("Installed");
    expect(output.includes("\x1b")).toBe(isTTY);
    expect(output).toMatch(/Installed in [\d.]+ s/);
  }
  expect(vi.getTimerCount()).toBe(0);
});
test("usage errors, JSON and quiet creation have consistent exit codes and no status pollution", async () => {
  const root = mkdtempSync(join(tmpdir(), "rivet-output-"));
  try {
    let p = io(root);
    expect(await main(["--templat", "static", "--json"], p)).toBe(2);
    expect(JSON.parse(p.out()).error).toContain("Did you mean --template?");
    expect(p.err()).toBe("");
    p = io(root);
    expect(await main(["app", "--no-install", "--no-git", "--json"], p)).toBe(0);
    expect(JSON.parse(p.out())).toMatchObject({ errors: 0, warnings: 0, installed: false });
    expect(p.err()).toBe("");
    p = io(root);
    expect(await main(["app", "--json", "--no-install", "--no-git"], p)).toBe(1);
    expect(JSON.parse(p.out()).error).toContain("not empty");
    p = io(root);
    expect(await main(["quiet", "--quiet", "--no-install", "--no-git"], p)).toBe(0);
    expect(p.out()).toBe("");
    expect(p.err()).toBe("");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("failed install and git report failure instead of successful scaffolding", async () => {
  const root = mkdtempSync(join(tmpdir(), "rivet-output-"));
  try {
    writeFileSync(join(root, "npm"), "#!/bin/sh\nprintf 'test install failure\\n' >&2\nexit 9\n", { mode: 0o755 });
    vi.stubEnv("PATH", root);
    const p = io(root);
    expect(await main(["app", "--json", "--no-git"], p)).toBe(1);
    expect(JSON.parse(p.out())).toMatchObject({ installed: false, errors: 1 });
    expect(p.err()).toBe("");
    writeFileSync(join(root, "git"), '#!/bin/sh\nif [ "$1" = "--version" ]; then exit 0; fi\nexit 1\n', { mode: 0o755 });
    const git = io(root);
    expect(await main(["git-app", "--json", "--no-install"], git)).toBe(1);
    expect(JSON.parse(git.out()).errors).toBe(1);
    const both = io(root);
    expect(await main(["both", "--json"], both)).toBe(1);
    expect(JSON.parse(both.out()).errors).toBe(2);
    expect(JSON.parse(both.out()).diagnostics).toHaveLength(2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
