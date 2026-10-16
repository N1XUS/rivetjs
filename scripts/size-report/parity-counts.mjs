// Test-case counts per file for the behaviour-floor suites (cdk, cdk-browser, cdk-components, ui, ui-components),
// collected by a filtered run (`-t` matching no test name: files are imported, every case is reported skipped, no hook
// or test body runs; `vitest list` parses `.tsx` without the Rivet loader). Pinned in `libs/ui/tests-components/parity-counts.json`: an API
// change may move cases between files but a suite's total and a file's count never drop without a listed reason
// (identity lane, spec `docs/design/specs/2026-10-11-ui-identity-design.md` §8.2).
// Usage: node scripts/size-report/parity-counts.mjs [--check]   (repo root; without --check rewrites the json)
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const root = new URL("../../", import.meta.url).pathname;
const out = join(root, "libs/ui/tests-components/parity-counts.json");
const PROJECTS = ["cdk", "cdk-browser", "cdk-components", "ui", "ui-components"];

const counts = {};
const tmp = mkdtempSync(join(tmpdir(), "parity-"));
try {
  for (const project of PROJECTS) {
    const file = join(tmp, project + ".json");
    const args = ["vitest", "run", "--project", project, "--maxWorkers=1", "-t", "__parity_counts_no_match__", "--reporter=json", `--outputFile=${file}`];
    execFileSync("npx", args, { cwd: root, stdio: ["ignore", "ignore", "inherit"] });
    for (const t of JSON.parse(readFileSync(file, "utf8")).testResults) counts[`${project}/${relative(root, t.name)}`] = t.assertionResults.length;
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
const total = (map, project) => Object.entries(map).reduce((n, [k, v]) => (k.startsWith(project + "/") ? n + v : n), 0);

if (process.argv.includes("--check")) {
  const pinned = JSON.parse(readFileSync(out, "utf8"));
  const drops = Object.entries(pinned)
    .filter(([key, n]) => (sorted[key] ?? 0) < n)
    .map(([key, n]) => `${key}: ${n} → ${sorted[key] ?? 0}`);
  for (const p of PROJECTS) if (total(sorted, p) < total(pinned, p)) drops.push(`${p} total: ${total(pinned, p)} → ${total(sorted, p)}`);
  if (drops.length) {
    console.error("parity counts dropped:\n  " + drops.join("\n  "));
    process.exit(1);
  }
  console.log(`parity counts: ok (${PROJECTS.map((p) => `${p} ${total(sorted, p)}`).join(", ")})`);
} else {
  writeFileSync(out, JSON.stringify(sorted, null, 2) + "\n");
  console.log(`parity counts written (${PROJECTS.map((p) => `${p} ${total(sorted, p)}`).join(", ")})`);
}
