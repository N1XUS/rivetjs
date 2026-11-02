// Every tracked .tsx must belong to a tsconfig project with JSX enabled, found the way editors find
// it (nearest tsconfig.json, then parent folders while a config does not include the file; TS 5.6+).
// Without one, editors fall back to a default project: "Cannot use JSX unless the '--jsx' flag…".
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = execFileSync("git", ["ls-files", "*.tsx"], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .map((file) => resolve(root, file))
  // Tracked but deleted in the worktree (a pending removal): nothing for an editor to open.
  .filter((file) => existsSync(file));
const projects = new Map<string, ts.ParsedCommandLine | undefined>();
/** Each project's file names as a Set (membership per tsx file, not an array scan). */
const fileSets = new Map<string, Set<string>>();
const project = (config: string) => {
  if (!projects.has(config)) {
    const parsed = ts.getParsedCommandLineOfConfigFile(config, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic() {} });
    projects.set(config, parsed);
    fileSets.set(config, new Set(parsed?.fileNames));
  }
  return projects.get(config);
};
const missing: string[] = [];
for (const file of files) {
  let owner: ts.ParsedCommandLine | undefined;
  for (let dir = dirname(file); ; ) {
    const config = ts.findConfigFile(dir, ts.sys.fileExists);
    if (!config) break;
    const parsed = project(config);
    if (parsed && fileSets.get(config)!.has(file)) {
      owner = parsed;
      break;
    }
    const parent = dirname(dirname(config));
    if (parent === dirname(config)) break;
    dir = parent;
  }
  if (!owner?.options.jsx) missing.push(file.slice(root.length + 1));
}
if (missing.length) {
  console.error(`No tsconfig project with JSX for:\n  ${missing.join("\n  ")}`);
  process.exitCode = 1;
} else console.log(`${files.length} .tsx files belong to JSX projects`);
