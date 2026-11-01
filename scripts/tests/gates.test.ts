// scripts/gates: planning (files → projects → ordered gates), selection, output classification, Qwik restore, CLI.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, test } from "vitest";
import { classify, failureLines, restoreQwikLines, sizeGrowth, timeRss, type KnownRed } from "../gates/classify.ts";
import { affectedProjects, matches, ownerOf, plan, select, vitestProjects, type Gate, type Project } from "../gates/plan.ts";
import { parseArgs, projectsFromGraph, table } from "../gates/run.ts";

const t = (command: string, dependsOn: string[] = []) => ({ commands: [command], dependsOn });
const tc = (root: string) => t(`node scripts/tsc.ts -p ${root}`);
const P = (name: string, root: string, deps: string[], targets: Project["targets"] = {}): Project => ({
  name,
  root,
  deps,
  targets: { typecheck: tc(root), ...targets },
});
const PROJECTS: Project[] = [
  P("reactivity", "libs/reactivity", [], { test: t("vitest run --project reactivity --project reactivity-dev") }),
  P("compiler", "libs/compiler", ["runtime"], { test: t("vitest run --project compiler") }),
  P("runtime", "libs/runtime", ["compiler", "reactivity"], { test: t("vitest run --project runtime --project runtime-dev") }),
  P("router", "libs/router", ["runtime"], { test: t("vitest run --project router") }),
  P("cdk", "libs/cdk", ["runtime"], { test: t('node scripts/vitest-seq.ts "--project cdk --project cdk-dev --maxWorkers=2" "--project cdk-browser"') }),
  P("docs-kit", "libs/docs-kit", ["cdk", "router"], { test: t("vitest run --project docs-kit") }),
  P("mcp", "libs/mcp", ["docs-kit"], { test: t("vitest run --project mcp") }),
  P("docs", "apps/docs", ["docs-kit"], { test: t("vitest run --project docs", ["build"]), build: t("node libs/docs-kit/cli.ts build apps/docs") }),
  P("ui-docs", "apps/ui-docs", ["docs-kit", "cdk"], { test: t("vitest run --project ui-docs"), build: t("x") }),
  P("cdk-docs", "apps/cdk-docs", ["docs-kit", "cdk"], { build: t("x") }),
  P("ssr-bench", "apps/ssr-bench", ["runtime"], {
    test: { commands: ["vitest run --project ssr-bench", "node apps/ssr-bench/run-python.ts -m unittest"], dependsOn: ["build"] },
    build: t("node apps/ssr-bench/build.ts"),
  }),
  P("vscode", "apps/vscode", []),
];
const base = { projects: PROJECTS, mode: "affected" as const, tests: "touched" as const, updateBaselines: false, base: "HEAD" };
const ids = (gates: Gate[]) => gates.map((g) => g.id);
const before = (gates: Gate[], a: string, b: string) => {
  const list = ids(gates);
  assert.ok(list.includes(a) && list.includes(b), `${a} and ${b} planned: ${list.join(" ")}`);
  assert.ok(list.indexOf(a) < list.indexOf(b), `${a} before ${b}`);
};

test("owner = longest root prefix; dependents are transitive; root config affects every project", () => {
  assert.equal(ownerOf("libs/runtime/dom.ts", PROJECTS), "runtime");
  assert.equal(ownerOf("libs/runtime-extra/x.ts", PROJECTS), "");
  assert.equal(ownerOf("scripts/x.ts", PROJECTS), "");
  const { touched, affected } = affectedProjects(["libs/cdk/a.ts"], PROJECTS);
  assert.deepEqual([...touched], ["cdk"]);
  assert.deepEqual([...affected].sort(), ["cdk", "cdk-docs", "docs", "docs-kit", "mcp", "ui-docs"]);
  assert.equal(affectedProjects(["package-lock.json"], PROJECTS).affected.size, PROJECTS.length);
  assert.deepEqual(vitestProjects(PROJECTS.find((p) => p.name === "cdk")!), ["cdk", "cdk-dev", "cdk-browser"]);
});

test("a router change: typecheck of dependents, vitest only of the touched project, docs builds + their suites, byte gates", () => {
  const gates = plan({ ...base, files: ["libs/router/build/coload.ts"] });
  const list = ids(gates);
  for (const id of [
    "typecheck:router",
    "typecheck:docs-kit",
    "typecheck:docs",
    "typecheck:ui-docs",
    "vitest:router",
    "build:docs",
    "vitest:docs",
    "zero-cost",
    "size",
    "format",
    "frames",
    "mcp-data",
  ])
    assert.ok(list.includes(id), `${id} planned: ${list.join(" ")}`);
  for (const id of ["vitest:runtime", "vitest:cdk", "parity", "vitest:scripts", "tsx-projects", "ai-files", "typecheck:vscode", "home-perf", "size:update"])
    assert.ok(!list.includes(id), `${id} not planned`);
  before(gates, "api:ui-docs", "typecheck:ui-docs");
  assert.deepEqual(gates.find((g) => g.id === "typecheck:ui-docs")!.requires, ["api:ui-docs"]);
  before(gates, "build:docs", "vitest:docs");
  assert.deepEqual(gates.find((g) => g.id === "vitest:docs")!.requires, ["build:docs"]);
  before(gates, "vitest:router", "build:docs");
  before(gates, "build:ui-docs", "frames");
  assert.equal(list.at(-1), "format");
  assert.match(gates.find((g) => g.id === "vitest:router")!.command, /--project router --maxWorkers=1$/);
  assert.equal(gates.find((g) => g.id === "vitest:router")!.env?.NODE_OPTIONS, "--max-old-space-size=2048");
  assert.equal(new Set(list).size, list.length, "ids unique");
});
test("router handler changes include the forms suites that directly import it", () => {
  const projects = [...PROJECTS, P("forms", "libs/forms", ["router"], { test: t("vitest run --project forms") })];
  const planned = (files: string[]) => ids(plan({ ...base, projects, files }));
  assert.ok(planned(["libs/router/server/handler.ts"]).includes("vitest:forms"), "handler changes must verify their forms consumers");
  const forms = plan({ ...base, projects, files: ["libs/router/server/handler.ts"] }).find((gate) => gate.id === "vitest:forms")!;
  assert.match(forms.command, /--maxWorkers=1$/, "forms production builds must run sequentially within the RSS cap");
  assert.match(plan({ ...base, files: ["libs/reactivity/index.ts"] }).find((gate) => gate.id === "vitest:reactivity")!.command, /--maxWorkers=2$/);
  assert.equal(planned(["libs/router/client/navigation.ts"]).includes("vitest:forms"), false);
  assert.equal(planned(["libs/router/server/handler.ts", "libs/forms/tests/server.test.ts"]).filter((id) => id === "vitest:forms").length, 1);
});

test("ssr-bench suites run after its build and before zero-cost (which wipes apps/ssr-bench/dist); --tests affected widens vitest", () => {
  const gates = plan({ ...base, files: ["apps/ssr-bench/adapters/react.ts"] });
  before(gates, "build:ssr-bench", "vitest:ssr-bench");
  before(gates, "build:ssr-bench", "python:ssr-bench");
  before(gates, "vitest:ssr-bench", "zero-cost");
  assert.ok(!ids(gates).includes("size"));
  const wide = ids(plan({ ...base, files: ["libs/runtime/a.ts"], tests: "affected" }));
  for (const id of ["vitest:runtime", "vitest:compiler", "vitest:router", "vitest:cdk-browser", "vitest:mcp", "vitest:docs"]) assert.ok(wide.includes(id), id);
});

test("--update-baselines: frames / zero-cost update, size update then check, home-perf between the docs build and its suite", () => {
  const gates = plan({ ...base, files: ["apps/docs/content/index.md"], updateBaselines: true });
  assert.match(gates.find((g) => g.id === "frames")!.command, /--update$/);
  assert.ok(!ids(gates).includes("zero-cost") || /--update$/.test(gates.find((g) => g.id === "zero-cost")!.command));
  before(gates, "build:docs", "home-perf");
  before(gates, "home-perf", "vitest:docs");
  assert.deepEqual(gates.find((g) => g.id === "vitest:docs")!.requires, ["home-perf"]);
  const runtime = plan({ ...base, files: ["libs/runtime/a.ts"], updateBaselines: true });
  assert.match(runtime.find((g) => g.id === "zero-cost")!.command, /check\.sh --update$/);
  before(runtime, "size:update", "size");
  assert.match(runtime.find((g) => g.id === "size")!.command, /-- --check$/);
});

test("path-triggered gates: scripts, compiler parity, generators, shards, AI files, tsx projects; ignored api.json", () => {
  const list = ids(
    plan({
      ...base,
      files: ["scripts/gen-events.mjs", "libs/compiler/src/x.ts", "templates/starter/AGENTS.md", "libs/cdk/a.tsx", "scripts/ci/test-shards.json"],
    }),
  );
  for (const id of ["vitest:scripts", "parity", "gen-events", "ai-files", "tsx-projects", "test-shards"]) assert.ok(list.includes(id), id);
  assert.deepEqual(ids(plan({ ...base, files: ["apps/ui-docs/src/generated/api.json"] })), ["format"]);
  assert.equal(plan({ ...base, files: [], base: "HEAD~3" }).at(-1)!.command, "node scripts/format-check.ts --base HEAD~3");
});

test("--only selects by id / group / glob and pulls in requirements; exact ids come from the --all catalog; --skip removes", () => {
  const planned = plan({ ...base, files: ["libs/router/a.ts"] });
  const catalog = plan({ ...base, mode: "all", files: [] });
  assert.ok(matches("typecheck:runtime", "typecheck") && matches("vitest:cdk-dev", "vitest:cdk*") && !matches("vitest:cdk", "vitest:cdk-*"));
  assert.deepEqual(ids(select(planned, catalog, ["vitest:docs"], [])), ["build:docs", "vitest:docs"]);
  assert.deepEqual(ids(select(planned, catalog, ["typecheck:ui-docs"], [])), ["api:ui-docs", "typecheck:ui-docs"]);
  assert.deepEqual(ids(select(planned, catalog, ["parity"], [])), ["parity"], "exact id outside the affected plan");
  const noTypecheck = ids(select(planned, catalog, [], ["typecheck", "size"]));
  assert.ok(!noTypecheck.some((id) => id.startsWith("typecheck:") || id === "size") && noTypecheck.includes("vitest:router"));
  const order = ids(catalog);
  const picked = ids(select(planned, catalog, ["format", "parity", "typecheck:router"], []));
  assert.deepEqual(
    picked,
    [...picked].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
    "catalog order",
  );
});

const REG: KnownRed[] = [{ gate: "vitest:runtime", match: "click-defer-browser.test.ts > first mouse click", reason: "timing", owner: "runtime" }];
const CTX = { registry: REG, sizeTolerance: 20, qwikChanged: false };
const VITEST_RED = `
 FAIL  |runtime| libs/runtime/tests/click-defer-browser.test.ts > first mouse click of a tab paints sooner
 FAIL  |runtime| libs/runtime/tests/click-defer-browser.test.ts > first mouse click of a tab paints sooner
      Tests  1 failed | 559 passed (560)`;

test("vitest: failures deduplicated; all known → known-red; one more → fail; pass shows the totals", () => {
  assert.deepEqual(failureLines("vitest", VITEST_RED), ["libs/runtime/tests/click-defer-browser.test.ts > first mouse click of a tab paints sooner"]);
  const known = classify({ id: "vitest:runtime", kind: "vitest" }, 1, VITEST_RED, CTX);
  assert.equal(known.status, "known-red");
  assert.equal(known.known[0]!.owner, "runtime");
  const fresh = classify({ id: "vitest:runtime", kind: "vitest" }, 1, VITEST_RED + "\n FAIL  |runtime| libs/runtime/tests/dom.test.ts > keyed rows", CTX);
  assert.equal(fresh.status, "fail");
  assert.equal(fresh.failures[0], "libs/runtime/tests/dom.test.ts > keyed rows");
  assert.equal(classify({ id: "vitest:runtime-dev", kind: "vitest" }, 1, VITEST_RED, CTX).status, "fail", "entry is per gate");
  assert.equal(classify({ id: "vitest:x", kind: "vitest" }, 1, "Error: No projects were found.", CTX).failures[0], "Error: No projects were found.");
  assert.equal(classify({ id: "vitest:runtime", kind: "vitest" }, 0, "      Tests  560 passed (560)\n", CTX).detail, "560 passed (560)");
  assert.equal(classify({ id: "x", kind: "generic" }, 3, "boom", CTX).status, "fail", "unrecognised failure stays red");
});

test("docs build examples, frames regressions, size growth within the tolerance = noise", () => {
  assert.deepEqual(failureLines("docs-build", "checks: FAILED example text-area-events: step {} failed\nchecks: FAILED example menu-submenu: x"), [
    "example text-area-events",
    "example menu-submenu",
  ]);
  assert.deepEqual(failureLines("frames", "frame payload regressions:\ndocs:counter: jsGz 900 exceeds ceiling 880 (+20)\n"), [
    "docs:counter: jsGz 900 exceeds ceiling 880 (+20)",
  ]);
  const grew =
    "size-report: grew vs scripts/size-report/baseline.json:\n  apps.playground.routes./slots.html.br: 2101 -> 2113 (+12)\n  apps.example:resume-demo.serverJS.br: 47673 -> 47690 (+17)\n";
  assert.equal(sizeGrowth(grew).length, 2);
  assert.equal(classify({ id: "size", kind: "size" }, 1, grew, CTX).status, "noise");
  assert.equal(classify({ id: "size", kind: "size" }, 1, grew + "  apps.starter-ui.routes./.css.min: 67190 -> 67362 (+172)\n", CTX).status, "fail");
  assert.equal(classify({ id: "size", kind: "size" }, 1, grew, { ...CTX, sizeTolerance: 10 }).status, "fail");
});

test("zero-cost: Qwik-only lane drift is noise unless Qwik sources changed; restore keeps base Qwik lines in path order", () => {
  const diff =
    "6c6\n< qwik.mjs 044b6e77a931\n---\n> qwik.mjs 111111111111\n12c12\n< client/build/q-1C3WhREl.js 132f759f30b1\n---\n> client/build/q-ZZZ.js 999\n";
  assert.equal(classify({ id: "zero-cost", kind: "zero-cost" }, 1, diff, CTX).status, "noise");
  assert.equal(classify({ id: "zero-cost", kind: "zero-cost" }, 1, diff, { ...CTX, qwikChanged: true }).status, "fail");
  assert.equal(classify({ id: "zero-cost", kind: "zero-cost" }, 1, diff + "< rivet.mjs aaa\n> rivet.mjs bbb\n", CTX).status, "fail");
  const baseLanes = "client/build/q-A.js 1\nqwik.mjs 2\nrivet.mjs 3\nsolid.mjs 4\n";
  const updated = "client/build/q-B.js 9\nqwik.mjs 8\nrivet.mjs 30\nreact.mjs 5\nsolid.mjs 4\n";
  assert.equal(restoreQwikLines(baseLanes, updated), "client/build/q-A.js 1\nqwik.mjs 2\nreact.mjs 5\nrivet.mjs 30\nsolid.mjs 4\n");
});

test("peak RSS from /usr/bin/time (macOS bytes, GNU kbytes)", () => {
  assert.equal(timeRss("        1121976320  maximum resident set size\n"), 1121976320);
  assert.equal(timeRss("\tMaximum resident set size (kbytes): 2048\n"), 2048 * 1024);
  assert.equal(timeRss("nothing"), null);
});

test("arguments, graph conversion, table", () => {
  const o = parseArgs(["--base", "HEAD~3", "--only=typecheck,vitest:router", "--update-baselines", "--size-tolerance", "40", "--all"]);
  assert.deepEqual([o.base, o.only, o.updateBaselines, o.sizeTolerance, o.mode], ["HEAD~3", ["typecheck", "vitest:router"], true, 40, "all"]);
  assert.throws(() => parseArgs(["--bogus"]), /unknown option/);
  assert.throws(() => parseArgs(["--tests", "some"]), /touched or affected/);
  const projects = projectsFromGraph({
    graph: {
      nodes: {
        a: {
          data: {
            root: "libs/a",
            targets: {
              test: { options: { commands: ["vitest run --project a", { command: "x" }] }, dependsOn: ["build", "^build", { target: "y", projects: ["b"] }] },
            },
          },
        },
        b: { data: { root: "libs/b" } },
      },
      dependencies: { a: [{ target: "b" }, { target: "b" }, { target: "npm:x" }], b: [] },
    },
  });
  assert.deepEqual(projects[0], {
    name: "a",
    root: "libs/a",
    deps: ["b"],
    targets: { test: { commands: ["vitest run --project a", "x"], dependsOn: ["build"] } },
  });
  assert.match(
    table([{ id: "format", status: "pass", duration: "1.0 s", rss: "80 MB", detail: "ok" }]),
    /^gate\s+status\s+duration\s+peak RSS\s+detail\n-+\nformat\s+pass\s+1\.0 s\s+80 MB\s+ok$/,
  );
});

const dir = mkdtempSync(join(tmpdir(), "gates-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
mkdirSync(join(dir, "apps/ui-docs"), { recursive: true });

const uiTypecheck = (config: Record<string, unknown>, workspace: Record<string, unknown> = {}, environmentRoot = dir, namedInputs?: unknown) => {
  const projects = projectsFromGraph(
    {
      graph: {
        nodes: { "ui-docs": { data: { root: "apps/ui-docs", targets: { typecheck: config }, ...(namedInputs ? { namedInputs } : {}) } } },
        dependencies: {},
      },
    },
    workspace,
    environmentRoot,
  );
  return plan({ ...base, projects, files: ["apps/ui-docs/example.ts"] });
};

test("UI-docs retains its exact native typecheck and API prerequisite without resident Nx wrappers", () => {
  const config = JSON.parse(readFileSync("apps/ui-docs/project.json", "utf8")).targets.typecheck;
  const gates = uiTypecheck(config);
  const gate = gates.find((g) => g.id === "typecheck:ui-docs")!;
  assert.equal(gate.command, config.options.command, "UI-docs must execute its complete committed native command without Nx residency");
  assert.deepEqual(gate.requires, ["api:ui-docs"]);
  assert.equal(gate.heavy, true);
  before(gates, "api:ui-docs", gate.id);
  const wrapped = uiTypecheck({ ...config, executor: "custom:checker" });
  assert.deepEqual(ids(gates), ids(wrapped), "removing the scheduler must not remove any gate");
});

let nxCounter = 0;
const nxFixture = (workspace: Record<string, unknown>, config: Record<string, unknown>, namedInputs?: unknown, dotenv?: string, fail = false) => {
  const work = join(dir, "nx-fixture-" + nxCounter++);
  mkdirSync(join(work, "apps/ui-docs"), { recursive: true });
  mkdirSync(join(work, "node_modules/.bin"), { recursive: true });
  mkdirSync(join(work, "libs/docs-kit"), { recursive: true });
  mkdirSync(join(work, "scripts"), { recursive: true });
  const nx = resolve("node_modules/nx");
  symlinkSync(nx, join(work, "node_modules/nx"));
  symlinkSync(join(nx, JSON.parse(readFileSync(join(nx, "package.json"), "utf8")).bin.nx), join(work, "node_modules/.bin/nx"));
  writeFileSync(join(work, "package.json"), JSON.stringify({ name: "gate-fixture", private: true }));
  writeFileSync(join(work, "nx.json"), JSON.stringify(workspace));
  writeFileSync(
    join(work, "apps/ui-docs/project.json"),
    JSON.stringify({ name: "ui-docs", root: "apps/ui-docs", ...(namedInputs ? { namedInputs } : {}), targets: { typecheck: config } }),
  );
  writeFileSync(join(work, "libs/docs-kit/cli.ts"), "import{writeFileSync}from'node:fs';writeFileSync('prepared','fresh');");
  writeFileSync(
    join(work, "scripts/tsc.ts"),
    "import assert from'node:assert/strict';import{readFileSync,writeFileSync}from'node:fs';assert.equal(readFileSync('prepared','utf8'),'fresh');if(process.env.EXPECT_DOTENV)assert.equal(process.env.FIXTURE_CHECK,'loaded');writeFileSync('checked','yes');if(" +
      (fail && !dotenv) +
      "){console.error('native checker diagnostic');process.exit(5);}if(process.env.RIVET_TSC==='fixture-diagnostic'){console.error('selected compiler diagnostic');process.exit(4);}",
  );
  writeFileSync(join(work, "runtime.mjs"), "import{writeFileSync}from'node:fs';writeFileSync('runtime-ran','yes');console.log('runtime-ok');");
  if (dotenv) writeFileSync(join(work, dotenv), "FIXTURE_CHECK=loaded\nRIVET_TSC=" + (fail ? "fixture-diagnostic" : "fixture") + "\n");
  const gate = uiTypecheck(config, workspace, work, namedInputs).find((g) => g.id === "typecheck:ui-docs")!;
  const env: NodeJS.ProcessEnv = { ...process.env, PATH: join(work, "node_modules/.bin") + ":" + process.env.PATH };
  delete env.NX_WORKSPACE_ROOT;
  delete env.NX_SKIP_NX_CACHE;
  delete env.RIVET_TSC;
  delete env.FIXTURE_CHECK;
  return { work, gate, run: (extra = {}) => spawnSync("sh", ["-c", gate.command], { cwd: work, encoding: "utf8", env: { ...env, ...extra } }) };
};

test("runtime inputs retain Nx execution and checker failure diagnostics", () => {
  const command = "node libs/docs-kit/cli.ts prepare apps/ui-docs && node scripts/tsc.ts -p apps/ui-docs --checkers 1";
  const runtime = { runtime: "node runtime.mjs" };
  const config = { executor: "nx:run-commands", cache: false, options: { command } };
  for (const [target, workspace, names] of [
    [{ ...config, inputs: [runtime] }, {}, undefined],
    [config, { targetDefaults: { typecheck: { inputs: [runtime] } } }, undefined],
    [config, { namedInputs: { default: [runtime] } }, undefined],
    [{ ...config, inputs: ["checked"] }, {}, { checked: [runtime] }],
  ] as const) {
    const gate = uiTypecheck(target, workspace, dir, names).find((g) => g.id === "typecheck:ui-docs")!;
    assert.match(gate.command, /nx run ui-docs:typecheck/, "runtime inputs must not disappear when cache is skipped");
  }
  for (const fail of [false, true]) {
    const fixture = nxFixture({}, { ...config, inputs: ["checked"] }, { checked: [runtime] }, undefined, fail);
    const result = fixture.run();
    assert.equal(existsSync(join(fixture.work, "runtime-ran")), true, "Nx must execute runtime inputs even with --skip-nx-cache");
    if (fail) {
      assert.notEqual(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout + result.stderr, /native checker diagnostic/);
      assert.equal(existsSync(join(fixture.work, "checked")), true);
    } else assert.equal(result.status, 0, result.stdout + result.stderr);
  }
}, 60000);

test("project and root dotenv files retain Nx loading and selected compiler diagnostics", () => {
  const config = {
    executor: "nx:run-commands",
    cache: false,
    options: { command: "node libs/docs-kit/cli.ts prepare apps/ui-docs && node scripts/tsc.ts -p apps/ui-docs --checkers 1" },
  };
  for (const dotenv of ["apps/ui-docs/.env.typecheck", ".local.env"]) {
    for (const fail of [false, true]) {
      const fixture = nxFixture({}, config, undefined, dotenv, fail);
      assert.match(fixture.gate.command, /nx run ui-docs:typecheck/, "dotenv context must not be dropped");
      const result = fixture.run({ EXPECT_DOTENV: "1" });
      if (fail) {
        assert.notEqual(result.status, 0);
        assert.match(result.stdout + result.stderr, /selected compiler diagnostic/);
      } else assert.equal(result.status, 0, result.stdout + result.stderr);
    }
  }
}, 60000);

test("unverified commands retain installed Nx interpolation and execution environment", () => {
  for (const command of ["node context.mjs {args}", "rivet-native-context-fixture"]) {
    const fixture = nxFixture({}, { executor: "nx:run-commands", cache: false, options: { command } });
    assert.match(fixture.gate.command, /nx run ui-docs:typecheck/, "only the verified UI command can bypass Nx");
    const body =
      "import assert from'node:assert/strict';import{writeFileSync}from'node:fs';assert.equal(process.env.NX_TASK_TARGET_PROJECT,'ui-docs');assert.equal(process.argv.includes('{args}'),false);writeFileSync('nx-context','preserved');";
    writeFileSync(join(fixture.work, "context.mjs"), body);
    writeFileSync(join(fixture.work, "node_modules/.bin/rivet-native-context-fixture"), "#!/usr/bin/env node\n" + body, { mode: 0o755 });
    const result = fixture.run({ PATH: process.env.PATH });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(readFileSync(join(fixture.work, "nx-context"), "utf8"), "preserved");
  }
}, 60000);

test("native UI typecheck runs preparation and preserves checker arguments and failure diagnostics", () => {
  const work = join(dir, "native-ui");
  mkdirSync(join(work, "libs/docs-kit"), { recursive: true });
  mkdirSync(join(work, "scripts"), { recursive: true });
  mkdirSync(join(work, "apps/ui-docs"), { recursive: true });
  writeFileSync(
    join(work, "libs/docs-kit/cli.ts"),
    "import{writeFileSync}from'node:fs';if(process.env.PREP_FAIL)process.exit(3);writeFileSync('prepared','fresh');",
  );
  writeFileSync(
    join(work, "scripts/tsc.ts"),
    "import assert from'node:assert/strict';import{readFileSync,writeFileSync}from'node:fs';assert.equal(readFileSync('prepared','utf8'),'fresh');assert.deepEqual(process.argv.slice(2),['-p','apps/ui-docs','--checkers','1']);writeFileSync('checked','yes');if(process.env.TYPE_FAIL){console.error('TS2322: native diagnostic');process.exit(2);}",
  );
  const command = "node libs/docs-kit/cli.ts prepare apps/ui-docs && node scripts/tsc.ts -p apps/ui-docs --checkers 1";
  const gate = uiTypecheck({ executor: "nx:run-commands", options: { command } }, {}, work).find((g) => g.id === "typecheck:ui-docs")!;
  assert.equal(gate.command, command);
  const run = (extra = {}) => spawnSync("sh", ["-c", gate.command], { cwd: work, encoding: "utf8", env: { ...process.env, ...extra } });
  assert.equal(run().status, 0);
  rmSync(join(work, "prepared"));
  const failed = run({ TYPE_FAIL: "1" });
  assert.equal(failed.status, 2);
  assert.match(failed.stderr, /TS2322: native diagnostic/);
  rmSync(join(work, "checked"));
  assert.equal(run({ PREP_FAIL: "1" }).status, 3);
  assert.equal(existsSync(join(work, "checked")), false, "failed preparation must prevent checker execution");
});

test("UI typechecks with Nx-specific behavior keep the scheduler and every prerequisite", () => {
  const command = "node libs/docs-kit/cli.ts prepare apps/ui-docs && node scripts/tsc.ts -p apps/ui-docs --checkers 1";
  const simple = { executor: "nx:run-commands", options: { command } };
  for (const config of [
    { ...simple, dependsOn: ["^typecheck"] },
    { ...simple, dependsOn: [{ target: "prepare", projects: ["other"] }] },
    { ...simple, options: { command, cwd: "apps/ui-docs" } },
    { ...simple, options: { command, env: { EXTRA_CHECK: "1" } } },
    { ...simple, options: { commands: [command] } },
    { ...simple, executor: "custom:checker" },
    { ...simple, configurations: { strict: {} } },
    { ...simple, defaultConfiguration: "strict" },
    { ...simple, syncGenerators: ["extra:prepare"] },
  ]) {
    const gate = uiTypecheck(config).find((g) => g.id === "typecheck:ui-docs")!;
    assert.match(gate.command, /nx run ui-docs:typecheck/, JSON.stringify(config));
    assert.deepEqual(gate.requires, ["api:ui-docs"]);
  }
});

test("workspace defaults and lifecycle hooks cannot bypass Nx through a simple project target", () => {
  const config = {
    executor: "nx:run-commands",
    options: { command: "node libs/docs-kit/cli.ts prepare apps/ui-docs && node scripts/tsc.ts -p apps/ui-docs --checkers 1" },
  };
  for (const workspace of [
    { targetDefaults: { typecheck: { dependsOn: ["^build"] } } },
    { targetDefaults: { "nx:run-commands": { options: { env: { STRICT: "1" } } } } },
    { targetDefaults: { "*": { dependsOn: ["prepare"] } } },
    { plugins: ["custom:hooks"] },
    { tasksRunnerOptions: { default: { runner: "custom:runner" } } },
    { sync: { globalGenerators: ["custom:prepare"] } },
  ]) {
    const gate = uiTypecheck(config, workspace).find((g) => g.id === "typecheck:ui-docs")!;
    assert.match(gate.command, /nx run ui-docs:typecheck/, "workspace-level task semantics must retain Nx: " + JSON.stringify(workspace));
  }
  const actual = JSON.parse(readFileSync("nx.json", "utf8"));
  assert.equal(uiTypecheck(config, actual).find((g) => g.id === "typecheck:ui-docs")!.command, config.options.command);
});

test("CLI --list --files --graph writes the plan as JSON and runs nothing", () => {
  const graph = join(dir, "graph.json");
  const nodes = Object.fromEntries(
    PROJECTS.map((p) => [
      p.name,
      {
        data: {
          root: p.root,
          targets: Object.fromEntries(Object.entries(p.targets).map(([k, v]) => [k, { options: { commands: v.commands }, dependsOn: v.dependsOn }])),
        },
      },
    ]),
  );
  writeFileSync(
    graph,
    JSON.stringify({ graph: { nodes, dependencies: Object.fromEntries(PROJECTS.map((p) => [p.name, p.deps.map((target) => ({ target }))])) } }),
  );
  const out = join(dir, "plan.json");
  const script = fileURLToPath(new URL("../gates/run.ts", import.meta.url));
  const run = spawnSync(process.execPath, [script, "--list", "--files", "libs/router/a.ts", "--graph", graph, "--json", out, "--only", "vitest:docs,format"], {
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /build:docs\s+planned/);
  const report = JSON.parse(readFileSync(out, "utf8"));
  assert.deepEqual(
    report.gates.map((g: { id: string }) => g.id),
    ["build:docs", "vitest:docs", "format"],
  );
  assert.deepEqual(report.touched, ["router"]);
});
