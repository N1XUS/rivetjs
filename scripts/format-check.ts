// Prettier check over the changed files only (the tree is not fully formatted yet, so a repo-wide
// check would fail on files nobody touched). A changed file is checked when its base version is
// prettier-clean (or it is new); files that were already unformatted at the base are listed as
// skipped, never reformatted behind their owner's back.
//   node scripts/format-check.ts                      # changes since the merge base with origin/main (else HEAD), incl. untracked
//   node scripts/format-check.ts --base origin/main   # explicit base ref (CI: the PR base)
//   node scripts/format-check.ts --write              # format the checked files instead of failing
// Options come from .prettierrc.json / .prettierignore (prettier's own resolution).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as prettier from "prettier";

const EXTENSIONS = /\.(?:[cm]?[jt]sx?|json)$/;

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const write = args.includes("--write");
const cwd = process.cwd();
const git = (...argv: string[]) => execFileSync("git", argv, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const tryGit = (...argv: string[]) => {
  try {
    return git(...argv);
  } catch {
    return undefined;
  }
};

const baseRef = flag("--base") ?? (tryGit("rev-parse", "--verify", "--quiet", "origin/main") ? "origin/main" : "HEAD");
const base = (tryGit("merge-base", baseRef, "HEAD") ?? git("rev-parse", baseRef)).trim();
const lines = (text: string | undefined) => (text ?? "").split("\n").filter(Boolean);
const changed = [...new Set([...lines(git("diff", "--name-only", "--diff-filter=ACMR", base)), ...lines(git("ls-files", "--others", "--exclude-standard"))])]
  .filter((file) => EXTENSIONS.test(file) && existsSync(resolve(cwd, file)))
  .sort();

const formatted = async (source: string, file: string) => {
  const options = (await prettier.resolveConfig(resolve(cwd, file))) ?? {};
  return prettier.check(source, { ...options, filepath: resolve(cwd, file) });
};
/** `formatted`, or the parse error when prettier cannot parse `source` (someone's half-written file): never crashes the gate. */
const tryFormatted = async (source: string, file: string): Promise<boolean | Error> => {
  try {
    return await formatted(source, file);
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
};
const firstLine = (error: Error) => error.message.split("\n")[0];

const failed: string[] = [];
const skipped: string[] = [];
const unparsable: string[] = [];
let checked = 0;
for (const file of changed) {
  const info = await prettier.getFileInfo(resolve(cwd, file), { ignorePath: [resolve(cwd, ".gitignore"), resolve(cwd, ".prettierignore")] });
  if (info.ignored || !info.inferredParser) continue;
  const before = tryGit("show", `${base}:${file}`);
  // Unformatted (or unparsable) at the base: someone else's file, never checked.
  if (before !== undefined && (await tryFormatted(before, file)) !== true) {
    skipped.push(file);
    continue;
  }
  const source = readFileSync(resolve(cwd, file), "utf8");
  const result = await tryFormatted(source, file);
  if (result instanceof Error) {
    // A syntax error is the typecheck / test gates' job; listing it keeps one broken file from hiding every real diff.
    unparsable.push(`${file}: ${firstLine(result)}`);
    continue;
  }
  checked++;
  if (result) continue;
  if (write) {
    const options = (await prettier.resolveConfig(resolve(cwd, file))) ?? {};
    writeFileSync(resolve(cwd, file), await prettier.format(source, { ...options, filepath: resolve(cwd, file) }));
    console.log(`formatted ${file}`);
  } else failed.push(file);
}

if (skipped.length) console.log(`skipped (not prettier-clean at ${base.slice(0, 8)}): ${skipped.length}\n  ${skipped.join("\n  ")}`);
if (unparsable.length) console.log(`skipped (prettier cannot parse): ${unparsable.length}\n  ${unparsable.join("\n  ")}`);
if (failed.length) {
  console.error(`not formatted:\n  ${failed.join("\n  ")}\nfix: npx prettier --write ${failed.join(" ")}`);
  process.exitCode = 1;
}
console.log(`format: ${checked} changed file(s) checked, ${failed.length} unformatted, ${skipped.length + unparsable.length} skipped`);
