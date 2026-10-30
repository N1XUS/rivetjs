import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, test } from "vitest";
import { runCampaign } from "../ai-tester/run.ts";
import { git } from "../ai-tester/workspace.ts";
import type { Agent } from "../ai-tester/types.ts";
const scratch = mkdtempSync(join(tmpdir(), "rivet-ai-run-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
const modules = resolve("node_modules");
let counter = 0;
const worker = join(scratch, "agent.mjs");
writeFileSync(
  worker,
  `
import {writeFileSync,mkdirSync} from 'node:fs';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
const [role,work,out,mode,main]=process.argv.slice(2);const put=(p,v)=>{mkdirSync(join(work,p,'..'),{recursive:true});writeFileSync(join(work,p),v)};
const run=(args)=>execFileSync('git',args,{cwd:main,stdio:'pipe'});
if(mode==='provider-error')process.exit(3);
if(mode==='hang')await new Promise(()=>setInterval(()=>{},1000));
if(role==='reviewer'){
 if(mode==='head-moved'){writeFileSync(join(main,'other.txt'),'new commit');run(['add','other.txt']);run(['commit','-qm','other actor']);}
 if(mode==='dirty-candidate')writeFileSync(join(main,'libs/reactivity/index.js'),'user changed it');
 if(mode==='mutating-review')put('libs/reactivity/index.js',"export const clear=()=>['tampered'];");
 writeFileSync(out,JSON.stringify({verdict:mode==='review-reject'?'reject':'accept',findings:mode==='review-reject'?['not a supported contract']:[]}));process.exit(0);
}
put('.artifacts/probe.txt','Executed seeded input clear([1]); actual [1], expected []');
if(mode.startsWith('no-finding')) {writeFileSync(out,JSON.stringify({disposition:'no-finding',summary:'No supported counterexample',scenario:'seeded clear scenario',expected:'[]',actual:'[]',changedPaths:[],testPaths:[],reproPaths:[],evidencePaths:['.artifacts/probe.txt'],regression:null}));process.exit(0);}
if(mode==='missing-result')process.exit(0);
let body="import assert from 'node:assert/strict';import {test} from 'vitest';import {clear} from '../index.js';test('clears read child',()=>assert.deepEqual(clear([1]),[], 'clears read child'));";
if(mode==='zero-tests')body="export const nothing=1;";
if(mode==='import-error')body="import './missing.js';"+body;
if(mode==='false-red')body="import {test} from 'vitest';test('clears read child',()=>{});";
put('libs/reactivity/tests/repro.test.ts',body);
if(mode!=='still-red')put('libs/reactivity/index.js',"export const clear=()=>[];");
if(mode==='out-of-scope')put('scripts/gates/run.ts','process.exit(0)');
const paths=['libs/reactivity/index.js','libs/reactivity/tests/repro.test.ts'];if(mode==='still-red')paths.shift();if(mode==='out-of-scope')paths.push('scripts/gates/run.ts');
writeFileSync(out,JSON.stringify({disposition:'finding',summary:'clear preserves removed elements',scenario:'clear([1])',expected:'[]',actual:'[1]',changedPaths:paths,testPaths:['libs/reactivity/tests/repro.test.ts'],reproPaths:['libs/reactivity/tests/repro.test.ts'],evidencePaths:[mode==='traversal'?'../outside':'.artifacts/probe.txt'],regression:{project:'reactivity',file:'libs/reactivity/tests/repro.test.ts',testName:'clears read child',assertion:'clears read child'}}));
`,
);
function fixture(mode = "ok") {
  const root = join(scratch, "repo-" + counter++);
  mkdirSync(root);
  execFileSync("git", ["init", "-q", root]);
  git(root, ["config", "user.name", "Fixture"]);
  git(root, ["config", "user.email", "fixture@example.test"]);
  const put = (p: string, v: string) => {
    mkdirSync(join(root, p, ".."), { recursive: true });
    writeFileSync(join(root, p), v);
  };
  put(".gitignore", "node_modules/\n.artifacts/\n");
  put("package.json", JSON.stringify({ type: "module", workspaces: ["libs/*"] }));
  put("libs/reactivity/package.json", JSON.stringify({ name: "@rivetjs/reactivity", type: "module", exports: "./index.js" }));
  put("libs/reactivity/index.js", mode.startsWith("no-finding") ? "export const clear=()=>[];" : "export const clear=(items)=>items;");
  const control =
    mode === "no-finding-hidden-source"
      ? "test('control',()=>{execFileSync('git',['update-index','--assume-unchanged','libs/reactivity/index.js']);writeFileSync('libs/reactivity/index.js','export const clear=()=>[1];');assert.equal(1,1);});"
      : mode === "no-finding-head-changed"
        ? "test('control',()=>{execFileSync('git',['commit','--allow-empty','-qm','changed baseline revision'],{stdio:'ignore'});assert.equal(1,1);});"
        : mode === "no-finding-skipped"
          ? "test.skip('control',()=>{});"
          : mode === "no-finding-todo"
            ? "test.todo('control');"
            : "test('control',()=>assert.equal(1,1));";
  put(
    "libs/reactivity/tests/control.test.ts",
    "import {test} from 'vitest';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {writeFileSync} from 'node:fs';" +
      control,
  );
  if (mode === "no-finding-mixed")
    put("libs/reactivity/tests/skipped.test.ts", "import {test} from 'vitest';test.skip('existing skip',()=>{});test.todo('existing todo');");
  put("vitest.config.ts", "export default {test:{projects:[{test:{name:'reactivity',include:['libs/reactivity/tests/*.test.ts'],environment:'node'}}]}};");
  // Only the external gates boundary is a small fixture; the supervisor still executes and validates plan and result as subprocesses.
  put(
    "scripts/gates/run.ts",
    `import {writeFileSync} from 'node:fs'; const a=process.argv.slice(2);const out=a[a.indexOf('--json')+1];writeFileSync(out,JSON.stringify({gates:${mode === "missing-gate" ? "a.includes('--list')?[{id:'test',status:'skipped',exitCode:null}]:[]" : "[{id:'test',status:a.includes('--list')?'skipped':'pass',exitCode:a.includes('--list')?null:0}]"}}));`,
  );
  git(root, ["add", "--", ".gitignore", "package.json", "libs", "vitest.config.ts", "scripts"]);
  git(root, ["commit", "-qm", "base"]);
  mkdirSync(join(root, "node_modules"));
  // Individual dependency links reproduce production snapshot setup, never a whole-node_modules symlink.
  for (const name of ["vitest", "vite", "@vitest", "@vitejs", "@rolldown", "@esbuild", "esbuild", "rolldown", "typescript"])
    if (existsSync(join(modules, name))) symlinkSync(join(modules, name), join(root, "node_modules", name));
  const agent: Agent = ({ role, workspace, output }) => ({ file: process.execPath, args: [worker, role, workspace, output, mode, root] });
  return { root, agent, base: git(root, ["rev-parse", "HEAD"]) };
}
test("seeded supported bug independently reproduces RED/GREEN and commits exactly the verified fix", async () => {
  const f = fixture();
  const result = await runCampaign({ ...f, area: "reactivity" });
  assert.equal(result.status, "committed", result.message ?? result.status);
  const redBytes = readFileSync(join(f.root, ".artifacts/ai-tester", result.id, "red.json"));
  assert.equal(result.hashes?.["proof:red.json"], createHash("sha256").update(redBytes).digest("hex"));
  assert.equal(git(f.root, ["rev-list", "--count", f.base + "..HEAD"]), "1");
  assert.equal(readFileSync(join(f.root, "libs/reactivity/index.js"), "utf8"), "export const clear=()=>[];");
  assert.match(git(f.root, ["log", "-1", "--format=%B"]), /Co-Authored-By: Claude Opus 5\.5/);
  assert.deepEqual(git(f.root, ["show", "--pretty=", "--name-only", "HEAD"]).split("\n").filter(Boolean), [
    "libs/reactivity/index.js",
    "libs/reactivity/tests/repro.test.ts",
  ]);
  assert.equal(git(f.root, ["diff", "--cached", "--name-only"]), "");
  assert.equal(git(f.root, ["diff", "--name-only"]), "");
});
test("unrelated staged, unstaged and untracked user work survives a verified commit byte for byte", async () => {
  const f = fixture();
  writeFileSync(join(f.root, "staged.txt"), "stage me");
  git(f.root, ["add", "--", "staged.txt"]);
  writeFileSync(join(f.root, "package.json"), "user edits");
  writeFileSync(join(f.root, "untracked.txt"), "untracked user");
  const index = git(f.root, ["ls-files", "--stage", "--", "staged.txt"]);
  const result = await runCampaign({ ...f, area: "reactivity" });
  assert.equal(result.status, "committed", result.message ?? result.status);
  assert.equal(git(f.root, ["ls-files", "--stage", "--", "staged.txt"]), index);
  assert.equal(readFileSync(join(f.root, "package.json"), "utf8"), "user edits");
  assert.equal(readFileSync(join(f.root, "untracked.txt"), "utf8"), "untracked user");
});
test("no-commit verifies the same real pipeline and leaves shared source and HEAD untouched", async () => {
  const f = fixture();
  const models: unknown[] = [];
  const agent: Agent = (context) => {
    models.push(context.model);
    return f.agent(context);
  };
  const result = await runCampaign({ ...f, agent, area: "reactivity", model: "gpt-6-astra", noCommit: true });
  assert.equal(result.status, "verified", result.message ?? result.status);
  assert.deepEqual(models, ["gpt-6-astra", "gpt-6-astra"]);
  assert.equal(result.model, "gpt-6-astra");
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
  assert.equal(readFileSync(join(f.root, "libs/reactivity/index.js"), "utf8"), "export const clear=(items)=>items;");
});
test("provider inspection respects the remaining campaign wall budget", async () => {
  const f = fixture();
  const bin = join(f.root, ".artifacts/bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, "codex"), "#!/usr/bin/env node\nsetTimeout(()=>process.exit(1),5000);");
  chmodSync(join(bin, "codex"), 0o755);
  const previous = process.env.PATH;
  process.env.PATH = bin + ":" + previous;
  const start = Date.now();
  try {
    const result = await runCampaign({ root: f.root, area: "reactivity", wallMs: 100 });
    assert.equal(result.status, "failed");
    assert.ok(Date.now() - start < 2000, "inspection must honor the campaign deadline");
  } finally {
    process.env.PATH = previous;
  }
});
test("no-finding requires an independently executed nonempty native suite and never commits", async () => {
  const f = fixture("no-finding");
  const result = await runCampaign({ ...f, area: "reactivity" });
  assert.equal(result.status, "no-finding", result.message ?? result.status);
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
});
test("no-finding accepts a native passing suite with existing skips and todos", async () => {
  const f = fixture("no-finding-mixed");
  const result = await runCampaign({ ...f, area: "reactivity" });
  assert.equal(result.status, "no-finding", result.message ?? result.status);
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
});
for (const mode of ["no-finding-skipped", "no-finding-todo"])
  test(`no-finding rejects a native suite with no executed assertions (${mode})`, async () => {
    const f = fixture(mode);
    const result = await runCampaign({ ...f, area: "reactivity" });
    assert.equal(result.status, "failed", JSON.stringify(result));
    assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
  });
for (const mode of [
  "zero-tests",
  "import-error",
  "false-red",
  "still-red",
  "review-reject",
  "missing-gate",
  "missing-result",
  "out-of-scope",
  "traversal",
  "provider-error",
  "mutating-review",
])
  test(`invalid proof (${mode}) cannot commit`, async () => {
    const f = fixture(mode);
    const result = await runCampaign({ ...f, area: "reactivity" });
    assert.ok(["failed", "needs-attention"].includes(result.status), JSON.stringify(result));
    assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
    assert.equal(git(f.root, ["diff", "--name-only"]), "");
  });
for (const mode of ["head-moved", "dirty-candidate"])
  test(`intake stops on ${mode} without overwriting concurrent work`, async () => {
    const f = fixture(mode);
    const result = await runCampaign({ ...f, area: "reactivity" });
    assert.equal(result.status, "needs-attention", result.message ?? result.status);
    if (mode === "head-moved") assert.equal(git(f.root, ["log", "-1", "--format=%s"]), "other actor");
    else assert.equal(readFileSync(join(f.root, "libs/reactivity/index.js"), "utf8"), "user changed it");
  });
test("a candidate dirty before launch is protected even if nominally in the selected area", async () => {
  const f = fixture();
  writeFileSync(join(f.root, "libs/reactivity/index.js"), "my existing work");
  const result = await runCampaign({ ...f, area: "reactivity" });
  assert.equal(result.status, "needs-attention");
  assert.equal(readFileSync(join(f.root, "libs/reactivity/index.js"), "utf8"), "my existing work");
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
});
test("campaign deadline and interruption are durable terminal failures and release the lock", async () => {
  const f = fixture("hang");
  const result = await runCampaign({ ...f, area: "reactivity", wallMs: 600 });
  assert.equal(result.status, "failed");
  assert.match(result.message ?? "", /timeout/);
  const controller = new AbortController();
  controller.abort();
  const stopped = await runCampaign({ ...f, area: "reactivity", signal: controller.signal });
  assert.equal(stopped.status, "interrupted");
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
});

test("staged/working-tree cancellation cannot hide user-owned candidate changes", async () => {
  const f = fixture();
  const path = "libs/reactivity/index.js";
  const target = join(f.root, path);
  const baseBytes = readFileSync(target);
  writeFileSync(target, "export const clear=()=>['user-staged'];");
  git(f.root, ["add", "--", path]);
  const staged = git(f.root, ["ls-files", "--stage", "--", path]);
  writeFileSync(target, baseBytes);
  const result = await runCampaign({ ...f, area: "reactivity" });
  assert.equal(result.status, "needs-attention");
  assert.equal(git(f.root, ["ls-files", "--stage", "--", path]), staged);
  assert.ok(readFileSync(target).equals(baseBytes));
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
});

test("assume-unchanged cannot hide actual candidate bytes from intake protection", async () => {
  const f = fixture();
  const path = "libs/reactivity/index.js";
  git(f.root, ["update-index", "--assume-unchanged", "--", path]);
  writeFileSync(join(f.root, path), "private user edits");
  const result = await runCampaign({ ...f, area: "reactivity" });
  assert.equal(result.status, "needs-attention");
  assert.equal(readFileSync(join(f.root, path), "utf8"), "private user edits");
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
});

test("no-finding rejects a baseline that changes its own snapshot HEAD", async () => {
  const f = fixture("no-finding-head-changed");
  const result = await runCampaign({ ...f, area: "reactivity" });
  assert.equal(result.status, "failed", result.message ?? result.status);
  assert.match(result.message ?? "", /snapshot|source|HEAD/i);
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
});

test("no-finding rejects baseline source edits hidden with assume-unchanged", async () => {
  const f = fixture("no-finding-hidden-source");
  const result = await runCampaign({ ...f, area: "reactivity" });
  assert.equal(result.status, "failed", result.message ?? result.status);
  assert.match(result.message ?? "", /snapshot|source/i);
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
});
