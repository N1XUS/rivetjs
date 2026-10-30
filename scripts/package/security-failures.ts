// Negative integration checks against the already-built audit image. Expected infrastructure failures must exit.
// node scripts/package/security-failures.ts
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "../..");
const work = resolve(root, ".artifacts/packaged-security");
const manifest = createHash("sha256")
  .update(readFileSync(resolve(work, "audit-manifest.json")))
  .digest("hex");
const results = [];
for (const probe of [
  { name: "stale-image", expected: /stale image/, vars: ["AUDIT_MANIFEST_SHA256=wrong-manifest"] },
  {
    name: "missing-chromium",
    expected: /Executable doesn't exist/,
    vars: ["AUDIT_MANIFEST_SHA256=" + manifest, "PLAYWRIGHT_BROWSERS_PATH=/audit-missing-browser"],
  },
]) {
  const output = resolve(work, "probes", probe.name);
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  const name = "rivet-package-security-" + process.pid + "-" + probe.name;
  let run;
  const started = performance.now();
  try {
    run = spawnSync(
      "docker",
      [
        "run",
        "--rm",
        "--name",
        name,
        "--network",
        "none",
        "--memory",
        "3g",
        "--cpus",
        "2",
        ...probe.vars.flatMap((value) => ["--env", value]),
        "--volume",
        output + ":/results",
        "rivet-packaged-security:audit",
      ],
      { cwd: root, encoding: "utf8", timeout: 30000, killSignal: "SIGKILL" },
    );
  } finally {
    spawnSync("docker", ["rm", "-f", name], { stdio: "ignore", timeout: 10000 });
  }
  writeFileSync(resolve(output, "process.log"), (run.stdout ?? "") + (run.stderr ?? ""));
  assert.equal(run.status, 2, `${probe.name} must exit with infrastructure status, not hang (${run.error?.message ?? run.status})`);
  const report = JSON.parse(readFileSync(resolve(output, "results.json"), "utf8"));
  assert.match(report.infrastructure, probe.expected);
  results.push({ name: probe.name, status: run.status, elapsedMs: Math.round(performance.now() - started) });
  console.log("PASS " + probe.name);
}
writeFileSync(resolve(work, "negative-results.json"), JSON.stringify(results, null, 2) + "\n");
