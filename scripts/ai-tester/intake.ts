import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { changedPaths, git, safeFile } from "./workspace.ts";
export class Attention extends Error {
  commit?: string;
}
export interface CandidateFile {
  path: string;
  data: Buffer;
}
const overlaps = (a: string, b: string) => a === b || a.startsWith(b + "/") || b.startsWith(a + "/");
export function assertIntake(root: string, base: string, paths: string[], originalDirty: string[]) {
  if (git(root, ["rev-parse", "HEAD"]) !== base) throw new Attention("HEAD moved during campaign; verified patch retained without intake");
  const dirty = [...originalDirty, ...changedPaths(root)];
  for (const path of paths) if (dirty.some((other) => overlaps(path, other))) throw new Attention(`Candidate overlaps user work: ${path}`);
  for (const path of paths) {
    const target = safeFile(root, path, true);
    const expected = git(root, ["--literal-pathspecs", "ls-tree", "--format=%(objectname)", base, "--", path]);
    const actual = existsSync(target) ? git(root, ["hash-object", "--no-filters", "--", path]) : "";
    if (actual !== expected) throw new Attention(`Candidate bytes differ from base (possibly hidden user work): ${path}`);
    const entries = git(root, ["--literal-pathspecs", "ls-files", "--stage", "--", path]);
    const fields = entries.split(/\s+/);
    if (expected ? fields[1] !== expected || fields[2] !== "0" || entries.split("\n").length !== 1 : entries !== "")
      throw new Attention(`Candidate index differs from base: ${path}`);
  }
}
export function intake(root: string, base: string, files: CandidateFile[], originalDirty: string[], dir: string, message: string): string {
  const paths = files.map((f) => f.path);
  assertIntake(root, base, paths, originalDirty);
  const index = git(root, ["rev-parse", "--path-format=absolute", "--git-path", "index"]);
  const lock = index + ".lock";
  let fd: number;
  try {
    fd = openSync(lock, "wx");
  } catch {
    throw new Attention("Git index is busy; verified patch retained");
  }
  const own = join(dir, "commit-index");
  const next = join(dirname(index), "ai-tester-index-" + randomUUID());
  const originals = new Map<string, Buffer | null>();
  let committed: string | undefined;
  try {
    assertIntake(root, base, paths, originalDirty);
    copyFileSync(index, next);
    for (const file of files) {
      const target = safeFile(root, file.path, true);
      originals.set(file.path, existsSync(target) ? readFileSync(target) : null);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, file.data);
    }
    const env = { GIT_INDEX_FILE: own };
    git(root, ["read-tree", base], undefined, env);
    git(root, ["--literal-pathspecs", "add", "--pathspec-from-file=-", "--pathspec-file-nul"], paths.join("\0") + "\0", env);
    const entries = git(root, ["--literal-pathspecs", "ls-files", "--stage", "-z", "--", ...paths], undefined, env);
    git(root, ["update-index", "-z", "--index-info"], entries, { GIT_INDEX_FILE: next });
    const tree = git(root, ["write-tree"], undefined, env);
    const msg = join(dir, "commit-message.txt");
    writeFileSync(msg, message);
    const sha = git(root, ["commit-tree", tree, "-p", base, "-F", msg], undefined, env);
    for (const file of files)
      if (!readFileSync(safeFile(root, file.path)).equals(file.data)) throw new Attention(`Candidate changed during intake: ${file.path}`);
    // Atomic compare-and-swap rejects a concurrent commit; commit-tree never moves the shared branch itself.
    git(root, ["update-ref", "-m", "ai-tester verified repair", "HEAD", sha, base]);
    committed = sha;
    renameSync(next, index);
    return sha;
  } catch (error) {
    if (!committed)
      for (const file of files) {
        const target = safeFile(root, file.path, true);
        if (existsSync(target) && readFileSync(target).equals(file.data)) {
          const original = originals.get(file.path);
          if (original) writeFileSync(target, original);
          else if (original === null) rmSync(target);
        }
      }
    if (committed) {
      const failure = new Attention(`Commit ${committed} created; index synchronization needs attention: ${String(error)}`);
      failure.commit = committed;
      throw failure;
    }
    throw error;
  } finally {
    closeSync(fd);
    rmSync(lock, { force: true });
    rmSync(own, { force: true });
    rmSync(next, { force: true });
  }
}
