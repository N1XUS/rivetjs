import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { Agent, Area, RunRecord, Regression } from "./types.ts";
import { acquireLock, changedPaths, git, safeFile, snapshot } from "./workspace.ts";
import { checkGates, checkRegression, parseFinding } from "./evidence.ts";
import { execute, type ProcessResult } from "./process.ts";
import { codex, reviewPrompt, schemas, workerPrompt } from "./agent.ts";
import { AREAS, checkScope } from "./policy.ts";
import { assertIntake, Attention, intake, type CandidateFile } from "./intake.ts";
export interface RunOptions {
  root: string;
  area: Area;
  noCommit?: boolean;
  wallMs?: number;
  rssLimitMB?: number;
  signal?: AbortSignal;
  agent?: Agent;
}
const hash = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");
const json = (file: string) => JSON.parse(readFileSync(file, "utf8"));
const same = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const literal = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export async function runCampaign(options: RunOptions): Promise<RunRecord> {
  const root = realpathSync(options.root);
  const wall = options.wallMs ?? 30 * 60000;
  const rss = options.rssLimitMB ?? 3072;
  if (!Object.hasOwn(AREAS, options.area) || !Number.isFinite(wall) || wall <= 0 || wall > 30 * 60000 || !Number.isFinite(rss) || rss <= 0 || rss > 3072)
    throw new Error("Invalid area or campaign budget");
  if (realpathSync(git(root, ["rev-parse", "--show-toplevel"])) !== root) throw new Error("Run from the repository root");
  const parent = join(root, ".artifacts/ai-tester");
  const release = acquireLock(parent);
  const id = new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomUUID().slice(0, 8);
  const dir = join(parent, id);
  mkdirSync(dir);
  const deadline = Date.now() + wall;
  const base = git(root, ["rev-parse", "HEAD"]);
  const originalDirty = changedPaths(root);
  const record: RunRecord = { id, area: options.area, base, status: "running", phase: "prepare", startedAt: new Date().toISOString(), peakRssBytes: 0 };
  const persist = () => {
    const temp = join(dir, "run.next.json");
    writeFileSync(temp, JSON.stringify(record, null, 2) + "\n");
    renameSync(temp, join(dir, "run.json"));
  };
  const event = (phase: string, detail?: string) => {
    record.phase = phase;
    appendFileSync(join(dir, "events.jsonl"), JSON.stringify({ at: new Date().toISOString(), phase, detail }) + "\n");
    persist();
  };
  let sequence = 0;
  const command = async (file: string, args: string[], cwd: string, label: string, stdin?: string): Promise<ProcessResult> => {
    if (options.signal?.aborted) throw new Error("interrupted");
    if (Date.now() >= deadline) throw new Error("timeout");
    const result = await execute({ file, args, cwd, stdin, log: join(dir, `${sequence++}-${label}.log`), deadline, rssLimitMB: rss, signal: options.signal });
    record.peakRssBytes = Math.max(record.peakRssBytes, result.peakRssBytes);
    persist();
    if (result.reason) throw new Error(result.reason);
    return result;
  };
  const checked = async (file: string, args: string[], cwd: string, label: string, stdin?: string) => {
    const result = await command(file, args, cwd, label, stdin);
    if (result.code !== 0) throw new Error(`${label} exited ${result.code}`);
    return result;
  };
  try {
    event("prepare");
    writeFileSync(join(dir, "base-tree.txt"), git(root, ["ls-tree", "-r", base]));
    writeFileSync(join(dir, "protected-paths.json"), JSON.stringify(originalDirty, null, 2));
    const work = join(dir, "work");
    const workBase = await snapshot(root, base, work);
    const schema = schemas(dir);
    const journal = join(parent, "coverage.jsonl");
    const history = existsSync(journal) ? readFileSync(journal, "utf8").split("\n").slice(-20).join("\n") : "No prior campaigns";
    const prompt = workerPrompt(options.area, base, history);
    writeFileSync(join(dir, "brief.md"), prompt);
    event("investigate");
    const output = join(dir, "worker.json");
    const agent = options.agent ?? codex;
    const worker = agent({ role: "worker", workspace: work, output, schema: schema.worker, prompt });
    await checked(worker.file, worker.args, work, "worker", worker.stdin);
    if (git(work, ["rev-parse", "HEAD"]) !== workBase) throw new Error("Worker changed snapshot HEAD");
    const finding = parseFinding(json(output));
    record.finding = finding;
    const paths = changedPaths(work);
    checkScope(options.area, finding, paths);
    const files: CandidateFile[] = paths.map((path) => ({ path, data: readFileSync(safeFile(work, path)) }));
    const candidateHashes = Object.fromEntries(files.map((f) => [f.path, hash(f.data)]));
    writeFileSync(join(dir, "candidate-hashes.json"), JSON.stringify(candidateHashes, null, 2));
    record.hashes = candidateHashes;
    for (const path of [...new Set([...finding.evidencePaths, ...finding.reproPaths])]) {
      const at = safeFile(work, path);
      const data = readFileSync(at);
      if (data.length > 10 * 1024 * 1024) throw new Error("Evidence file exceeds 10 MiB");
      const into = join(dir, "evidence", path);
      mkdirSync(dirname(into), { recursive: true });
      writeFileSync(into, data);
    }
    if (finding.disposition === "needs-attention") throw new Attention(finding.summary);
    const test = async (cwd: string, regression: Regression | null, label: string) => {
      const report = join(dir, label + ".json");
      const args = [
        join(cwd, "node_modules/vitest/vitest.mjs"),
        "run",
        "--project",
        regression?.project ?? AREAS[options.area].projects[0],
        "--maxWorkers=1",
        "--reporter=json",
        "--outputFile",
        report,
      ];
      if (regression) args.push(regression.file, "-t", literal(regression.testName));
      const result = await command(process.execPath, args, cwd, label);
      return { value: json(report), code: result.code };
    };
    if (finding.disposition === "no-finding") {
      event("baseline-probe");
      const result = await test(work, null, "baseline");
      const v = result.value;
      if (
        result.code !== 0 ||
        v.success !== true ||
        !(v.numTotalTests > 0) ||
        v.numFailedTests !== 0 ||
        !Array.isArray(v.testResults) ||
        !v.testResults.length ||
        v.testResults.some((f: any) => f.message || f.status !== "passed")
      )
        throw new Error("No-finding baseline did not execute a passing native suite");
      if (changedPaths(work).length) throw new Error("No-finding probe mutated source files");
      record.status = "no-finding";
      record.message = finding.summary;
    } else {
      assertIntake(root, base, paths, originalDirty);
      event("reproduce");
      const validation = join(dir, "validation");
      const validationBase = await snapshot(root, base, validation);
      for (const path of finding.testPaths) {
        if (!path.includes("/tests/")) throw new Error("Base overlay may contain only tests/fixtures");
        const file = files.find((f) => f.path === path)!;
        const at = safeFile(validation, path, true);
        mkdirSync(dirname(at), { recursive: true });
        writeFileSync(at, file.data);
      }
      const regression = finding.regression!;
      const red = await test(validation, regression, "red");
      const identity = checkRegression(red.value, regression, red.code, "red");
      event("repair-proof");
      for (const file of files) {
        const at = safeFile(validation, file.path, true);
        mkdirSync(dirname(at), { recursive: true });
        writeFileSync(at, file.data);
      }
      const green = await test(validation, regression, "green");
      checkRegression(green.value, regression, green.code, "green", identity);
      const verifyCandidate = () => {
        if (!same(changedPaths(validation), paths) || git(validation, ["rev-parse", "HEAD"]) !== validationBase)
          throw new Attention("Validation source inventory changed");
        for (const file of files)
          if (!readFileSync(safeFile(validation, file.path)).equals(file.data)) throw new Attention(`Verified candidate changed: ${file.path}`);
      };
      verifyCandidate();
      git(validation, ["--literal-pathspecs", "add", "--pathspec-from-file=-", "--pathspec-file-nul"], paths.join("\0") + "\0");
      event("gates");
      const plan = join(dir, "gate-plan.json");
      const gates = join(dir, "gates.json");
      const common = ["scripts/gates/run.ts", "--base", validationBase, "--files", paths.join(","), "--slots", "1", "--rss-limit", String(rss)];
      await checked(process.execPath, [...common, "--list", "--json", plan], validation, "gate-plan");
      await checked(process.execPath, [...common, "--json", gates], validation, "gates");
      checkGates(json(plan), json(gates));
      verifyCandidate();
      const index = join(dir, "patch-index");
      const env = { GIT_INDEX_FILE: index };
      git(validation, ["read-tree", "HEAD"], undefined, env);
      git(validation, ["--literal-pathspecs", "add", "--pathspec-from-file=-", "--pathspec-file-nul"], paths.join("\0") + "\0", env);
      writeFileSync(join(dir, "candidate.patch"), git(validation, ["diff", "--cached", "--binary", "HEAD"], undefined, env) + "\n");
      writeFileSync(join(dir, "paths.json"), JSON.stringify(paths, null, 2));
      event("review");
      const reviewOutput = join(dir, "reviewer.json");
      const reviewer = agent({
        role: "reviewer",
        workspace: validation,
        output: reviewOutput,
        schema: schema.reviewer,
        prompt: reviewPrompt(options.area, dir),
      });
      await checked(reviewer.file, reviewer.args, validation, "reviewer", reviewer.stdin);
      const review = json(reviewOutput);
      if (Object.keys(review).sort().join() !== "findings,verdict" || review.verdict !== "accept" || !Array.isArray(review.findings) || review.findings.length)
        throw new Attention("Independent review did not accept the repair");
      verifyCandidate();
      assertIntake(root, base, paths, originalDirty);
      if (options.noCommit) {
        record.status = "verified";
        record.message = "Verified patch retained; --no-commit";
      } else {
        event("intake");
        const subject = finding.summary.split(/[\r\n]/)[0].slice(0, 100);
        const message = `fix(${options.area}): ${subject}\n\n${finding.scenario}\nExpected: ${finding.expected}\nObserved before repair: ${finding.actual}\n\nAutonomous tester ${id}: independent native RED/GREEN, complete affected\ngates and read-only review accepted. Evidence: .artifacts/ai-tester/${id}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n`;
        record.commit = intake(root, base, files, originalDirty, dir, message);
        record.status = "committed";
        record.message = finding.summary;
      }
    }
    appendFileSync(journal, JSON.stringify({ id, base, area: options.area, scenario: finding.scenario, status: record.status, commit: record.commit }) + "\n");
  } catch (error) {
    record.status = options.signal?.aborted ? "interrupted" : error instanceof Attention ? "needs-attention" : "failed";
    record.message = error instanceof Error ? error.message : String(error);
    if (error instanceof Attention && error.commit) record.commit = error.commit;
  } finally {
    record.finishedAt = new Date().toISOString();
    event(record.status, record.message);
    for (const entry of readdirSync(dir, { withFileTypes: true }))
      if (entry.isFile() && entry.name !== "run.json" && entry.name !== "run.next.json" && entry.name !== "patch-index") {
        record.hashes ??= {};
        record.hashes["proof:" + entry.name] = hash(readFileSync(join(dir, entry.name)));
      }
    persist();
    release();
  }
  return record;
}
