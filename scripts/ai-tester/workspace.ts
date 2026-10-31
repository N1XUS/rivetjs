import { execFileSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, posix, resolve } from "node:path";
import { randomUUID } from "node:crypto";

function gitBytes(root: string, args: string[], input?: string | Buffer, extraEnv: NodeJS.ProcessEnv = {}): Buffer {
  const env = { ...process.env };
  delete env.GIT_INDEX_FILE;
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  return execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
    cwd: root,
    env: { ...env, ...extraEnv },
    input,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
}
export function git(root: string, args: string[], input?: string | Buffer, extraEnv: NodeJS.ProcessEnv = {}): string {
  return gitBytes(root, args, input, extraEnv).toString("utf8").trimEnd();
}
export function changedPaths(root: string): string[] {
  const names = [
    git(root, ["diff", "--name-only", "-z"]),
    git(root, ["diff", "--cached", "--name-only", "-z"]),
    git(root, ["ls-files", "--others", "--exclude-standard", "-z"]),
  ];
  return [...new Set(names.flatMap((v) => v.split("\0").filter(Boolean)))].sort();
}
/** Check actual tracked bytes, including paths hidden by assume-unchanged/stat cache flags. */
export function assertSnapshotSource(root: string, base: string, overlays: readonly { path: string; data: Buffer }[] = []): void {
  const names = overlays.map((file) => file.path).sort();
  if (new Set(names).size !== names.length || git(root, ["rev-parse", "HEAD"]) !== base || JSON.stringify(changedPaths(root)) !== JSON.stringify(names))
    throw new Error("Snapshot source inventory or HEAD changed");
  const entries = new Map(
    git(root, ["ls-tree", "-r", "-z", base])
      .split("\0")
      .filter(Boolean)
      .map((entry) => {
        const match = /^(100644|100755) blob ([0-9a-f]+)\t(.+)$/.exec(entry);
        if (!match) throw new Error("Invalid snapshot source inventory");
        safeFile(root, match[3]!);
        return [match[3]!, match[2]!] as const;
      }),
  );
  if (!entries.size) throw new Error("Empty snapshot source inventory");
  for (const file of overlays) {
    safeFile(root, file.path);
    entries.set(file.path, git(root, ["hash-object", "--no-filters", "--stdin"], file.data));
  }
  const paths = [...entries.keys()];
  const actual = git(root, ["hash-object", "--no-filters", "--stdin-paths"], paths.map((path) => JSON.stringify(path)).join("\n") + "\n").split("\n");
  if (actual.length !== paths.length || paths.some((path, i) => entries.get(path) !== actual[i])) throw new Error("Snapshot source bytes changed");
}
/** Serialize exact proposed blobs in a private index, without writing candidate bytes into the proof tree. */
export function candidatePatch(root: string, base: string, files: readonly { path: string; data: Buffer }[], index: string): Buffer {
  const env = { GIT_INDEX_FILE: index };
  git(root, ["read-tree", base], undefined, env);
  const entries = files.map((file) => {
    safeFile(root, file.path, true);
    const entry = git(root, ["--literal-pathspecs", "ls-tree", "-z", base, "--", file.path]);
    const mode = entry ? /^(100644|100755) blob /.exec(entry)?.[1] : "100644";
    if (!mode) throw new Error("Invalid proposed source mode");
    const blob = git(root, ["hash-object", "--no-filters", "-w", "--stdin"], file.data);
    return `${mode} ${blob}\t${file.path}\0`;
  });
  git(root, ["update-index", "-z", "--index-info"], entries.join(""), env);
  return gitBytes(
    root,
    [
      "diff",
      "--cached",
      "--binary",
      "--no-ext-diff",
      "--no-textconv",
      "--no-color",
      "--src-prefix=a/",
      "--dst-prefix=b/",
      "--output-indicator-new=+",
      "--output-indicator-old=-",
      "--output-indicator-context= ",
      base,
    ],
    undefined,
    env,
  );
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
