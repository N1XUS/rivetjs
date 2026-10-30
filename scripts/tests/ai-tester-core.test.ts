import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, test } from "vitest";
import { safeFile, snapshot, git, changedPaths, acquireLock } from "../ai-tester/workspace.ts";
import { checkBaseline, checkRegression, checkGates, parseFinding } from "../ai-tester/evidence.ts";
import { checkScope } from "../ai-tester/policy.ts";
import type { Area, Finding } from "../ai-tester/types.ts";
import { execute } from "../ai-tester/process.ts";

const temp = mkdtempSync(join(tmpdir(), "rivet-ai-core-"));
afterAll(() => rmSync(temp, { recursive: true, force: true }));
function repo(label: string) {
  const root = join(temp, label);
  mkdirSync(root);
  execFileSync("git", ["init", "-q", root]);
  git(root, ["config", "user.name", "Fixture"]);
  git(root, ["config", "user.email", "fixture@example.test"]);
  return root;
}
function save(root: string, file: string, data: string) {
  mkdirSync(join(root, file, ".."), { recursive: true });
  writeFileSync(join(root, file), data);
}
function commit(root: string, paths: string[]) {
  git(root, ["add", "--", ...paths]);
  git(root, ["commit", "-qm", "fixture"]);
}

test("snapshot Rivet imports execute snapshot source and exclude dirty/untracked checkout data", async () => {
  const root = repo("resolution");
  save(root, ".gitignore", "node_modules/\n.artifacts/\n");
  save(root, "package.json", JSON.stringify({ type: "module", workspaces: ["libs/*"] }));
  save(
    root,
    "libs/reactivity/package.json",
    JSON.stringify({ name: "@rivetjs/reactivity", type: "module", exports: "./index.js", bin: { marker: "./bin.js" } }),
  );
  save(root, "libs/reactivity/index.js", "export const marker='base';");
  save(root, "libs/reactivity/bin.js", "import {marker} from './index.js'; console.log(marker);");
  commit(root, [".gitignore", "package.json", "libs/reactivity"]);
  mkdirSync(join(root, "node_modules/.bin"), { recursive: true });
  symlinkSync(join(root, "libs/reactivity/bin.js"), join(root, "node_modules/.bin/marker"));
  mkdirSync(join(root, "node_modules/@rivetjs"), { recursive: true });
  symlinkSync(join(root, "libs/reactivity"), join(root, "node_modules/@rivetjs/reactivity"));
  save(root, "libs/reactivity/index.js", "export const marker='dirty-main';");
  save(root, "untracked-secret.txt", "user work");
  const work = join(temp, "snapshot");
  await snapshot(root, git(root, ["rev-parse", "HEAD"]), work);
  assert.ok(realpathSync(join(work, "node_modules/@rivetjs/reactivity")).startsWith(realpathSync(work)));
  save(work, "libs/reactivity/index.js", "export const marker='fixed-snapshot';");
  const value = execFileSync(process.execPath, ["--input-type=module", "-e", "import {marker} from '@rivetjs/reactivity'; console.log(marker)"], {
    cwd: work,
    encoding: "utf8",
  });
  assert.equal(value.trim(), "fixed-snapshot");
  assert.equal(execFileSync(process.execPath, [join(work, "node_modules/.bin/marker")], { cwd: work, encoding: "utf8" }).trim(), "fixed-snapshot");
  assert.equal(readFileSync(join(root, "libs/reactivity/index.js"), "utf8"), "export const marker='dirty-main';");
  assert.deepEqual(changedPaths(work), ["libs/reactivity/index.js"]);
  assert.throws(() => readFileSync(join(work, "untracked-secret.txt")));
});

test("candidate files reject traversal, root metadata, and symlink ancestors", () => {
  const root = join(temp, "paths");
  mkdirSync(root);
  save(root, "valid/test.ts", "ok");
  symlinkSync(tmpdir(), join(root, "escape"));
  symlinkSync(join(root, "missing-target"), join(root, "dangling"));
  assert.throws(() => safeFile(root, "dangling", true));
  assert.equal(safeFile(root, "valid/test.ts"), join(realpathSync(root), "valid/test.ts"));
  for (const path of ["../outside", "/tmp/outside", "valid/../test.ts", ".git/config", "escape/file", "valid\\test.ts", "valid/test.ts\n"])
    assert.throws(() => safeFile(root, path), { name: "Error" }, path);
});

test("exclusive lock never steals a live owner's lock and releases only its own", () => {
  const root = join(temp, "locks");
  mkdirSync(root);
  const release = acquireLock(root);
  assert.throws(() => acquireLock(root), /campaign.*running|locked/i);
  release();
  const next = acquireLock(root);
  next();
});

const regression = { project: "reactivity", file: "libs/reactivity/tests/repro.test.ts", testName: "clears read child", assertion: "clears read child" };
function report(status = "failed", message = "AssertionError: clears read child") {
  return {
    numTotalTests: 1,
    numFailedTests: status === "failed" ? 1 : 0,
    numPassedTests: status === "passed" ? 1 : 0,
    numPendingTests: 0,
    numTodoTests: 0,
    success: status === "passed",
    testResults: [
      {
        name: "/work/" + regression.file,
        message: "",
        status,
        assertionResults: [{ fullName: "clears read child", title: "clears read child", status, failureMessages: status === "failed" ? [message] : [] }],
      },
    ],
  };
}
test("RED proof accepts a real matching assertion and GREEN preserves the same discovered test", () => {
  const red = checkRegression(report(), regression, 1, "red");
  assert.equal(red, "clears read child");
  assert.equal(checkRegression(report("passed"), regression, 0, "green", red), red);
});
test("regression proof permits filtered unrelated tests while requiring one matching executed assertion", () => {
  const filtered = (status: string) => {
    const value = report(status);
    value.numTotalTests = 3;
    value.numPendingTests = 1;
    value.numTodoTests = 1;
    value.testResults[0]!.assertionResults.push(
      { fullName: "unrelated filtered test", title: "unrelated filtered test", status: "skipped", failureMessages: [] },
      { fullName: "unrelated todo", title: "unrelated todo", status: "todo", failureMessages: [] },
    );
    return value;
  };
  const red = checkRegression(filtered("failed"), regression, 1, "red");
  assert.equal(checkRegression(filtered("passed"), regression, 0, "green", red), red);
  const skipped = filtered("passed");
  skipped.numPassedTests = 0;
  skipped.numPendingTests = 2;
  skipped.testResults[0]!.assertionResults[0]!.status = "skipped";
  assert.throws(() => checkRegression(skipped, regression, 0, "green"));
  const extra = filtered("passed");
  extra.numPassedTests = 2;
  extra.numPendingTests = 0;
  extra.testResults[0]!.assertionResults[1]!.status = "passed";
  assert.throws(() => checkRegression(extra, regression, 0, "green"));
  const wrong = filtered("passed");
  wrong.testResults[0]!.assertionResults[0]!.fullName = "other test";
  wrong.testResults[0]!.assertionResults[0]!.title = "other test";
  assert.throws(() => checkRegression(wrong, regression, 0, "green"));
  const forged = filtered("passed");
  forged.numPendingTests = 0;
  assert.throws(() => checkRegression(forged, regression, 0, "green"));
});
test("zero tests, import/setup failures, unrelated assertions and false RED cannot validate a fix", () => {
  for (const value of [
    { ...report(), numTotalTests: 0 },
    report("failed", "Error: Cannot find module foo"),
    report("failed", "AssertionError: some other behavior"),
    { ...report(), testResults: [{ ...report().testResults[0], message: "beforeAll exploded" }] },
  ])
    assert.throws(() => checkRegression(value, regression, 1, "red"));
  assert.throws(() => checkRegression(report("passed"), regression, 0, "red"));
  assert.throws(() => checkRegression(report("failed"), regression, 1, "green", "clears read child"));
  assert.throws(() => checkRegression(report("passed"), regression, 0, "green", "different discovered test"));
});
function baselineReport() {
  const value = report("passed");
  return {
    ...value,
    numTotalTests: 3,
    numPendingTests: 1,
    numTodoTests: 1,
    testResults: [
      {
        ...value.testResults[0],
        assertionResults: [
          value.testResults[0].assertionResults[0],
          { fullName: "existing skip", title: "existing skip", status: "skipped", failureMessages: [] },
          { fullName: "existing todo", title: "existing todo", status: "todo", failureMessages: [] },
        ],
      },
    ],
  };
}
test("no-finding baseline requires executed passing tests while retaining existing skips and todos", () => {
  assert.doesNotThrow(() => checkBaseline(baselineReport(), 0));
  const good = baselineReport();
  const skipped = {
    ...good,
    numPassedTests: 0,
    numPendingTests: 2,
    testResults: [
      {
        ...good.testResults[0],
        assertionResults: good.testResults[0].assertionResults.map((a) => ({ ...a, status: a.status === "passed" ? "skipped" : a.status })),
      },
    ],
  };
  const todo = {
    ...good,
    numPassedTests: 0,
    numPendingTests: 0,
    numTodoTests: 3,
    testResults: [{ ...good.testResults[0], assertionResults: good.testResults[0].assertionResults.map((a) => ({ ...a, status: "todo" })) }],
  };
  for (const value of [
    skipped,
    todo,
    { ...good, success: false },
    { ...good, numTotalTests: 0 },
    { ...good, numPassedTests: undefined },
    { ...good, numPassedTests: "1" },
    { ...good, numPendingTests: -1 },
    { ...good, numFailedTests: 1 },
    { ...good, numTotalTests: 4 },
    { ...good, testResults: [] },
    { ...good, testResults: [{ ...good.testResults[0], message: "beforeAll failed" }] },
    { ...good, testResults: [{ ...good.testResults[0], assertionResults: [] }] },
    { ...good, testResults: [{ ...good.testResults[0], assertionResults: [{ ...good.testResults[0].assertionResults[0], status: "failed" }] }] },
  ])
    assert.throws(() => checkBaseline(value, 0));
  assert.throws(() => checkBaseline(good, 1));
});
test("complete trusted gate plan is required; omitted or failed gates cannot count as success", () => {
  const plan = { gates: [{ id: "format" }, { id: "vitest:reactivity" }] };
  const good = {
    gates: [
      { id: "format", status: "pass", exitCode: 0 },
      { id: "vitest:reactivity", status: "pass", exitCode: 0 },
    ],
  };
  assert.doesNotThrow(() => checkGates(plan, good));
  for (const value of [
    { gates: [] },
    { gates: [good.gates[0]] },
    { gates: [good.gates[0], { ...good.gates[1], status: "blocked" }] },
    { gates: [good.gates[0], good.gates[0]] },
  ])
    assert.throws(() => checkGates(plan, value));
});
test("malformed model results and command strings are rejected before execution", () => {
  assert.throws(() => parseFinding({ disposition: "finding", command: "touch /tmp/owned" }));
});

test("subprocess timeout terminates the owned process group and returns failure", async () => {
  const result = await execute({
    file: process.execPath,
    args: ["-e", "setInterval(()=>{},1000)"],
    cwd: temp,
    log: join(temp, "timeout.log"),
    deadline: Date.now() + 250,
    rssLimitMB: 3072,
  });
  assert.equal(result.reason, "timeout");
  assert.notEqual(result.code, 0);
});

test("memory budget violation fails before the command can finish successfully", async () => {
  const result = await execute({
    file: process.execPath,
    args: ["-e", "setInterval(()=>{},1000)"],
    cwd: temp,
    log: join(temp, "memory.log"),
    deadline: Date.now() + 3000,
    rssLimitMB: 1,
  });
  assert.equal(result.reason, "memory-limit");
  assert.notEqual(result.code, 0);
});

test("timeout also closes a detached server started by an owned child", async () => {
  const log = join(temp, "detached.log");
  let pid: number | undefined;
  try {
    await execute({
      file: process.execPath,
      args: [
        "-e",
        `const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});console.log('OWNED_CHILD='+child.pid);setInterval(()=>{},1000)`,
      ],
      cwd: temp,
      log,
      deadline: Date.now() + 500,
      rssLimitMB: 3072,
    });
    pid = Number(/OWNED_CHILD=(\d+)/.exec(readFileSync(log, "utf8"))?.[1]);
    assert.ok(pid > 0);
    let live = true;
    for (let i = 0; i < 30; i++) {
      let state = "";
      try {
        state = execFileSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      } catch {}
      live = !!state && !state.startsWith("Z");
      if (!live) break;
      await new Promise((done) => setTimeout(done, 20));
    }
    assert.equal(live, false, "owned detached server survived timeout");
  } finally {
    if (pid)
      try {
        process.kill(-pid, "SIGKILL");
      } catch {}
  }
});

test("nested workspace dependencies preserve pinned tools and redirect Rivet peers to the snapshot", async () => {
  const root = repo("nested");
  save(root, ".gitignore", "node_modules/\n.artifacts/\n");
  save(root, "package.json", JSON.stringify({ type: "module", workspaces: ["libs/*", "apps/*"] }));
  save(root, "libs/reactivity/package.json", JSON.stringify({ name: "@rivetjs/reactivity", type: "module", exports: "./index.js" }));
  save(root, "libs/reactivity/index.js", "export const marker='base';");
  save(root, "apps/stable/package.json", JSON.stringify({ name: "rivet-fixture-stable", type: "module" }));
  save(root, "apps/stable/check.mjs", "import {marker} from '@rivetjs/reactivity';import {tool} from 'private-tool';console.log(marker+':'+tool);");
  commit(root, [".gitignore", "package.json", "libs", "apps"]);
  mkdirSync(join(root, "node_modules/@rivetjs"), { recursive: true });
  symlinkSync(join(root, "libs/reactivity"), join(root, "node_modules/@rivetjs/reactivity"));
  mkdirSync(join(root, "apps/stable/node_modules/@rivetjs"), { recursive: true });
  symlinkSync(join(root, "libs/reactivity"), join(root, "apps/stable/node_modules/@rivetjs/reactivity"));
  save(root, "apps/stable/node_modules/private-tool/package.json", JSON.stringify({ name: "private-tool", type: "module", exports: "./index.js" }));
  save(root, "apps/stable/node_modules/private-tool/index.js", "export const tool='pinned';");
  const work = join(temp, "nested-snapshot");
  await snapshot(root, git(root, ["rev-parse", "HEAD"]), work);
  save(work, "libs/reactivity/index.js", "export const marker='snapshot';");
  assert.ok(existsSync(join(work, "apps/stable/node_modules/private-tool")), "nested dependency was omitted");
  assert.equal(execFileSync(process.execPath, ["apps/stable/check.mjs"], { cwd: work, encoding: "utf8" }).trim(), "snapshot:pinned");
});
test("gate and build configuration cannot be changed through an otherwise allowed area", () => {
  const cases: [Area, string, string, string][] = [
    ["reactivity", "libs/reactivity/project.json", "reactivity", "libs/reactivity/tests/repro.test.ts"],
    ["router", "libs/router/project.json", "router", "libs/router/tests/repro.test.ts"],
    ["resume", "examples/operations/vite.config.ts", "runtime", "libs/runtime/tests/repro.test.ts"],
  ];
  for (const [area, path, project, file] of cases) {
    const finding: Finding = {
      disposition: "finding",
      summary: "x",
      scenario: "x",
      expected: "x",
      actual: "x",
      changedPaths: [path, file],
      testPaths: [file],
      reproPaths: [file],
      evidencePaths: [".artifacts/probe.txt"],
      regression: { project, file, testName: "x", assertion: "x" },
    };
    assert.throws(() => checkScope(area, finding, [path, file]), { name: "Error" }, path);
  }
});

test("snapshot retains tracked files covered by current ignore rules", async () => {
  const root = repo("tracked-ignored");
  save(root, ".gitignore", "results/\nnode_modules/\n");
  save(root, "results/report.json", '{"historical":true}');
  git(root, ["add", "--force", "--", ".gitignore", "results/report.json"]);
  git(root, ["commit", "-qm", "tracked ignored evidence"]);
  const work = join(temp, "tracked-ignored-snapshot");
  await snapshot(root, git(root, ["rev-parse", "HEAD"]), work);
  assert.equal(readFileSync(join(work, "results/report.json"), "utf8"), '{"historical":true}');
  assert.deepEqual(changedPaths(work), []);
});

test("worker scope rejects nested tool configuration even beside a valid regression", () => {
  for (const name of [".npmrc", ".gitattributes", ".gitignore", ".yarnrc.yml", ".node-version", ".env.test"]) {
    const changed = ["libs/reactivity/" + name, "libs/reactivity/tests/repro.test.ts"].sort();
    const finding = { changedPaths: changed, testPaths: ["libs/reactivity/tests/repro.test.ts"], regression } as Finding;
    assert.throws(() => checkScope("reactivity", finding, changed), /Protected change/, name);
  }
});
