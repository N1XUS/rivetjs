import { execFileSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, posix, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export function git(root: string, args: string[], input?: string, extraEnv: NodeJS.ProcessEnv = {}): string {
  const env = { ...process.env };
  delete env.GIT_INDEX_FILE;
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  return execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
    cwd: root,
    env: { ...env, ...extraEnv },
    input,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  }).trimEnd();
}
export function changedPaths(root: string): string[] {
  const names = [
    git(root, ["diff", "--name-only", "-z"]),
    git(root, ["diff", "--cached", "--name-only", "-z"]),
    git(root, ["ls-files", "--others", "--exclude-standard", "-z"]),
  ];
  return [...new Set(names.flatMap((v) => v.split("\0").filter(Boolean)))].sort();
}
export function safeFile(root: string, path: string, missing = false): string {
  if (
    !path ||
    isAbsolute(path) ||
    /[\\,\x00-\x1f\x7f]/.test(path) ||
    posix.normalize(path) !== path ||
    path.startsWith("../") ||
    path === ".." ||
    path.startsWith("./") ||
    path.split("/").some((p) => p === ".git" || p === "node_modules")
  )
    throw new Error(`Unsafe repository path: ${JSON.stringify(path)}`);
  let at = realpathSync(root);
  const parts = path.split("/");
  for (let i = 0; i < parts.length; i++) {
    at = join(at, parts[i]);
    let stat;
    try {
      stat = lstatSync(at);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" && missing) continue;
      throw error;
    }
    if (stat.isSymbolicLink() || (i === parts.length - 1 ? !stat.isFile() : !stat.isDirectory())) throw new Error(`Not a regular repository file: ${path}`);
  }
  return at;
}
export function acquireLock(root: string): () => void {
  mkdirSync(root, { recursive: true });
  const dir = join(root, "campaign.lock");
  try {
    mkdirSync(dir);
  } catch {
    throw new Error(`A campaign is already running or locked: ${dir}`);
  }
  const token = randomUUID();
  writeFileSync(join(dir, "owner.json"), JSON.stringify({ pid: process.pid, token }));
  return () => {
    if (JSON.parse(readFileSync(join(dir, "owner.json"), "utf8")).token === token) rmSync(dir, { recursive: true });
  };
}
function dependencies(source: string, target: string) {
  const local = new Map<string, string>();
  const bins = new Map<string, string>();
  for (const parent of ["libs", "apps"]) {
    if (!existsSync(join(target, parent))) continue;
    for (const name of readdirSync(join(target, parent))) {
      const file = join(target, parent, name, "package.json");
      if (!existsSync(file)) continue;
      const pkg = JSON.parse(readFileSync(file, "utf8"));
      if (typeof pkg.name === "string") {
        local.set(pkg.name, dirname(file));
        const entries = typeof pkg.bin === "string" ? { [pkg.name.split("/").pop()!]: pkg.bin } : (pkg.bin ?? {});
        for (const [name, path] of Object.entries(entries)) if (typeof path === "string") bins.set(name, join(dirname(file), path));
      }
    }
  }
  const mirror = (from: string, into: string) => {
    if (!existsSync(from)) return;
    mkdirSync(into, { recursive: true });
    const link = (name: string) => {
      const origin = local.get(name) ?? join(from, name);
      const dest = join(into, name);
      mkdirSync(dirname(dest), { recursive: true });
      if (name === "@qwik.dev/core" || name === "@builder.io/qwik") cpSync(realpathSync(origin), dest, { recursive: true });
      else symlinkSync(origin, dest, "dir");
    };
    for (const name of readdirSync(from)) {
      if (name.startsWith(".")) continue;
      if (name.startsWith("@")) {
        for (const member of readdirSync(join(from, name))) link(name + "/" + member);
      } else link(name);
    }
    const binDir = join(into, ".bin");
    mkdirSync(binDir);
    const sourceBins = join(from, ".bin");
    if (existsSync(sourceBins)) for (const name of readdirSync(sourceBins)) symlinkSync(bins.get(name) ?? join(sourceBins, name), join(binDir, name));
    for (const [name, file] of bins) if (!existsSync(join(binDir, name))) symlinkSync(file, join(binDir, name));
    for (const [name, dir] of local) {
      const dest = join(into, name);
      if (!existsSync(dest)) {
        mkdirSync(dirname(dest), { recursive: true });
        symlinkSync(dir, dest, "dir");
      }
    }
  };
  mirror(join(source, "node_modules"), join(target, "node_modules"));
  for (const dir of local.values()) {
    const relative = dir.slice(target.length + 1);
    mirror(join(source, relative, "node_modules"), join(dir, "node_modules"));
  }
}
export async function snapshot(source: string, base: string, target: string): Promise<string> {
  if (existsSync(target)) throw new Error("Snapshot destination already exists");
  mkdirSync(dirname(target), { recursive: true });
  const tar = join(dirname(target), randomUUID() + ".tar");
  try {
    git(source, ["archive", "--format=tar", "-o", tar, base]);
    mkdirSync(target);
    execFileSync("tar", ["-xf", tar, "-C", target]);
  } finally {
    rmSync(tar, { force: true });
  }
  git(target, ["init", "-q"]);
  git(target, ["config", "user.name", "Rivet AI tester"]);
  git(target, ["config", "user.email", "rivet-ai-tester@example.invalid"]);
  const paths = git(source, ["ls-tree", "-r", "--name-only", "-z", base]);
  git(target, ["--literal-pathspecs", "add", "--force", "--pathspec-from-file=-", "--pathspec-file-nul"], paths);
  git(target, ["commit", "-qm", "snapshot base"]);
  dependencies(resolve(source), resolve(target));
  return git(target, ["rev-parse", "HEAD"]);
}
