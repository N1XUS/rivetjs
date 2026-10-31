// Gate planning for scripts/gates/run.ts: changed files → nx projects (owner by root, dependents through the project
// graph) → the ordered gate list. Pure functions (no git / nx / fs); run.ts feeds them. Orchestration only: every gate
// runs the same command CI or the root CLAUDE.md "Gates" section documents.

export interface Project {
  name: string;
  /** Workspace-relative root, e.g. `libs/runtime`. */
  root: string;
  /** Target name → shell command(s) and nx `dependsOn` target names (own-project ones only, `^x` dropped). */
  targets: Record<string, { commands: string[]; dependsOn: string[] }>;
  /** Projects this one depends on (nx graph edges). */
  deps: string[];
}

export interface Gate {
  /** Stable id: `typecheck:runtime`, `vitest:cdk-browser`, `build:docs`, `zero-cost`, … (`--only` / `--skip` match it). */
  id: string;
  /** Shell command (`sh -c`), run from the repo root. */
  command: string;
  /** Heavy gates take a slot of the shared heavy-command semaphore (builds, vitest, typecheck, size, zero-cost). */
  heavy: boolean;
  /** Gates that must have passed (or be known-red) first; a failed requirement blocks this gate. */
  requires: string[];
  /** Output classifier (run.ts `classify`). */
  kind: "generic" | "vitest" | "docs-build" | "size" | "frames" | "zero-cost";
  /** Extra environment. */
  env?: Record<string, string>;
  /** Why the gate was planned (first matching cause). */
  why: string;
}

export interface PlanOptions {
  files: string[];
  projects: Project[];
  /** `all`: every gate for every project; `affected`: from `files`. */
  mode: "affected" | "all";
  /** `touched`: vitest for projects owning a changed file (+ dist-reading suites of planned builds); `affected`: every affected project. */
  tests: "touched" | "affected";
  updateBaselines: boolean;
  /** Base ref (format check). */
  base: string;
}

/** Changed paths never fed to the planner: `docs-kit api apps/ui-docs` rewrites it before the ui-docs typecheck. */
export const IGNORED_FILES = new Set(["apps/ui-docs/src/generated/api.json"]);

/** Root files every project's nx inputs include (`nx.json` `sharedGlobals`) + the vitest / tsconfig roots. */
const GLOBAL_FILES = new Set(["package.json", "package-lock.json", "nx.json", "tsconfig.base.json", ".nvmrc", "vitest.config.ts"]);

export const DOCS_APPS = ["docs", "cdk-docs", "ui-docs"] as const;
/** Packages `scripts/zero-cost` hashes (runtime-hashes + packages-hashes + cdk entries) + the ssr-bench lanes + the oracle. */
const ZERO_COST = [
  "reactivity",
  "runtime",
  "router",
  "forms",
  "i18n",
  "kit",
  "ui",
  "motion",
  "bridge",
  "bridge-react",
  "bridge-preact",
  "bridge-solid",
  "bridge-vue",
  "bridge-svelte",
  "cdk",
  "compiler",
  "ssr-bench",
];
/** Libraries whose bytes `scripts/size-report.mjs` measures (apps through their own paths below). */
const SIZE_LIBS = ["reactivity", "runtime", "router", "compiler", "kit", "i18n", "forms", "ui", "cdk", "motion"];

const NX = "NX_DAEMON=false NX_ISOLATE_PLUGINS=false npx nx";
const VITEST_ENV = { NODE_OPTIONS: "--max-old-space-size=2048" };

/** Owner project of a path: longest matching project root ("" when none). */
export function ownerOf(file: string, projects: Project[]): string {
  let best = "";
  let length = -1;
  for (const project of projects) {
    const root = project.root.replace(/\/$/, "");
    if ((file === root || file.startsWith(root + "/")) && root.length > length) {
      best = project.name;
      length = root.length;
    }
  }
  return best;
}

/** Projects owning a changed file, and those plus every transitive dependent (nx affected). A global root file affects all. */
export function affectedProjects(files: string[], projects: Project[]): { touched: Set<string>; affected: Set<string>; global: boolean } {
  const touched = new Set<string>();
  let global = false;
  for (const file of files) {
    if (GLOBAL_FILES.has(file)) global = true;
    const owner = ownerOf(file, projects);
    if (owner) touched.add(owner);
  }
  if (global) {
    const all = new Set(projects.map((p) => p.name));
    return { touched: new Set([...touched]), affected: all, global };
  }
  const dependents = new Map<string, string[]>();
  for (const project of projects) for (const dep of project.deps) dependents.set(dep, [...(dependents.get(dep) ?? []), project.name]);
  const affected = new Set(touched);
  const queue = [...touched];
  while (queue.length) for (const next of dependents.get(queue.pop()!) ?? []) if (!affected.has(next)) (affected.add(next), queue.push(next));
  return { touched, affected, global };
}

/** vitest project names of an nx `test` target (`--project x` in its command lines). */
export function vitestProjects(project: Project): string[] {
  const test = project.targets.test;
  if (!test) return [];
  return [...new Set(test.commands.flatMap((command) => [...command.matchAll(/--project[ =]([\w-]+)/g)].map((m) => m[1]!)))];
}

const any = (files: string[], pattern: RegExp) => files.some((file) => pattern.test(file));

/** The ordered gate list (prerequisites before dependents; `requires` always point backwards). */
export function plan(options: PlanOptions): Gate[] {
  const { projects, mode, updateBaselines } = options;
  const files = options.files.filter((file) => !IGNORED_FILES.has(file));
  const all = mode === "all";
  const byName = new Map(projects.map((p) => [p.name, p]));
  const { touched, affected, global } = all
    ? { touched: new Set(byName.keys()), affected: new Set(byName.keys()), global: true }
    : affectedProjects(files, projects);
  const tested = all || options.tests === "affected" ? affected : touched;
  const has = (name: string) => byName.has(name);
  const isAffected = (name: string) => affected.has(name);
  const why = (name: string) =>
    all ? "--all" : touched.has(name) ? `changed files in ${byName.get(name)?.root ?? name}` : global ? "root config changed" : "depends on a changed project";
  const gates: Gate[] = [];
  const add = (gate: Omit<Gate, "heavy" | "requires" | "kind"> & Partial<Pick<Gate, "heavy" | "requires" | "kind">>) =>
    gates.push({ heavy: false, requires: [], kind: "generic", ...gate });
  const docsApps = DOCS_APPS.filter((app) => has(app) && isAffected(app));

  // 1. typecheck (sequential: tsgo memory). The ui-docs one needs the generated API first.
  const typechecked = [...affected].filter((name) => byName.get(name)?.targets.typecheck).sort();
  if (typechecked.includes("ui-docs"))
    add({ id: "api:ui-docs", command: "node libs/docs-kit/cli.ts api apps/ui-docs", why: "ui-docs typecheck reads src/generated/api.json" });
  for (const name of typechecked)
    add({
      id: `typecheck:${name}`,
      command: `${NX} run ${name}:typecheck --output-style=static --skip-nx-cache`,
      heavy: true,
      requires: name === "ui-docs" ? ["api:ui-docs"] : [],
      why: why(name),
    });
  if (all || any(files, /\.tsx$|(^|\/)tsconfig[^/]*\.json$|^scripts\/check-tsx-projects\.ts$/))
    add({ id: "tsx-projects", command: "node scripts/check-tsx-projects.ts", why: all ? "--all" : ".tsx / tsconfig changed" });

  // 2. cheap generator / content checks (CI `gates` job).
  if (all || any(files, /^scripts\/gen-events\.mjs$|^libs\/runtime\/jsx-events\.ts$|^libs\/compiler\/rust\/src\/events_data\.rs$|^package-lock\.json$/))
    add({ id: "gen-events", command: "node scripts/gen-events.mjs --check", why: "event list sources changed" });
  if (all || any(files, /^scripts\/gen-row-wasm\.mjs$|^libs\/runtime\/server-rows(-wasm)?\.ts$/))
    add({ id: "gen-row-wasm", command: "node scripts/gen-row-wasm.mjs --check", why: "row emitter sources changed" });
  if (all || global || any(files, /^scripts\/ci\/|(^|\/)project\.json$|(^|\/)package\.json$|^\.github\/workflows\/ci\.yml$/))
    add({ id: "test-shards", command: "node scripts/ci/check-test-shards.ts", why: "nx targets / shards may have changed" });
  if (
    all ||
    any(files, /^libs\/compiler\/codes\.json$|^libs\/language-core\/explain\.json$|^apps\/docs\/content\/errors\//) ||
    isAffected("docs-kit") ||
    touched.has("docs")
  )
    add({ id: "errors", command: "node libs/docs-kit/cli.ts errors apps/docs --check", why: "diagnostic codes / docs changed" });
  for (const app of docsApps) {
    add({ id: `content:${app}`, command: `node libs/docs-kit/cli.ts check-content apps/${app} --strict`, why: why(app) });
    add({ id: `snippets:${app}`, command: `node libs/docs-kit/cli.ts check-snippets apps/${app}`, why: why(app) });
    add({ id: `llms:${app}`, command: `node libs/docs-kit/cli.ts llms apps/${app} --check`, why: why(app) });
  }
  // The data file is gitignored: a stale local copy fails --check, so rebuild it first (as every intake did).
  if (docsApps.length || (has("mcp") && isAffected("mcp")))
    add({ id: "mcp-data", command: "node libs/mcp/build-data.ts && node libs/mcp/build-data.ts --check", why: "docs sites / mcp changed" });
  if (all || (has("mcp") && touched.has("mcp")) || any(files, /^templates\/|^skills\/|^libs\/create-rivet\/|^libs\/mcp\/ai\//))
    add({ id: "ai-files", command: "node libs/mcp/ai/sync.ts --check", why: "AI instruction sources changed" });
  if (all || (has("compiler") && touched.has("compiler")))
    add({ id: "parity", command: `${NX} run compiler:parity --output-style=static --skip-nx-cache`, heavy: true, why: why("compiler") });

  // 3. vitest per project (nx `test` target's --project list); suites reading built output run after their build.
  // ui-docs:test does not depend on its build (CI builds in its own job), but tests/home.test.ts reads the built site.
  const buildFirst = (name: string) => name === "ui-docs" || (byName.get(name)?.targets.test?.dependsOn.includes("build") ?? false);
  // Forms tests import the handler directly (router/CLAUDE.md); touched-only selection must retain that consumer.
  const handlerConsumers = files.includes("libs/router/server/handler.ts") ? ["forms"] : [];
  const testedProjects = [...new Set([...tested, ...handlerConsumers, ...docsApps.filter((app) => app !== "cdk-docs")])]
    .filter((name) => byName.get(name)?.targets.test)
    .sort();
  const plain = testedProjects.filter((name) => !buildFirst(name));
  const afterBuild = testedProjects.filter(buildFirst);
  const vitest = (name: string, requires: string[]) => {
    for (const v of vitestProjects(byName.get(name)!))
      add({
        id: `vitest:${v}`,
        command: `npx vitest run --project ${v} --maxWorkers=2`,
        heavy: true,
        kind: "vitest",
        env: VITEST_ENV,
        requires,
        why: why(name),
      });
    if (name === "ssr-bench")
      add({
        id: "python:ssr-bench",
        command: "node apps/ssr-bench/run-python.ts -m unittest discover -s apps/ssr-bench/tests -p 'test_*.py'",
        requires,
        why: why(name),
      });
  };
  for (const name of plain) vitest(name, []);
  // One worker: the ai-eval Chromium checks beside the package-build tarball smoke peaked at 3.7 GB (tree) with two.
  if (all || any(files, /^scripts\//))
    add({
      id: "vitest:scripts",
      command: "npx vitest run --project scripts --maxWorkers=1",
      heavy: true,
      kind: "vitest",
      env: VITEST_ENV,
      why: all ? "--all" : "scripts/ changed",
    });

  // 4. builds (one at a time) + the suites that read them.
  const build = (name: string) =>
    add({
      id: `build:${name}`,
      command: `${NX} run ${name}:build --output-style=static --skip-nx-cache`,
      heavy: true,
      kind: DOCS_APPS.includes(name as never) ? "docs-build" : "generic",
      why: why(name),
    });
  for (const name of afterBuild.filter((n) => !DOCS_APPS.includes(n as never))) {
    build(name);
    vitest(name, [`build:${name}`]);
  }
  for (const app of docsApps) {
    build(app);
    if (app === "docs" && updateBaselines) {
      // home-perf.ts measures the built site; its JSON is site content, so a changed JSON needs a rebuild before the site tests.
      const json = "apps/docs/content/_home-perf.json";
      add({
        id: "home-perf",
        command: `before=$(cksum < ${json}); node apps/docs/scripts/home-perf.ts && { [ "$(cksum < ${json})" = "$before" ] || ${NX} run docs:build --output-style=static --skip-nx-cache; }`,
        heavy: true,
        kind: "docs-build",
        requires: ["build:docs"],
        why: "--update-baselines: regenerate _home-perf.json from the build",
      });
    }
    if (afterBuild.includes(app)) vitest(app, [app === "docs" && updateBaselines ? "home-perf" : `build:${app}`]);
  }

  // 5. byte gates (each builds its own apps; zero-cost wipes apps/ssr-bench/dist, so it runs after the ssr-bench suite).
  if (all || (has("docs") && isAffected("docs")) || (has("ui-docs") && isAffected("ui-docs")) || any(files, /^scripts\/size-report\/frame/))
    add({
      id: "frames",
      command: `node scripts/size-report/frames.mjs ${updateBaselines ? "--update" : "--check"}`,
      heavy: true,
      kind: "frames",
      why: updateBaselines ? "--update-baselines" : "docs / ui-docs frames may change",
    });
  if (all || ZERO_COST.some((name) => isAffected(name)) || any(files, /^scripts\/zero-cost\/|^apps\/ssr-bench\/|^package-lock\.json$/))
    add({
      id: "zero-cost",
      command: `sh scripts/zero-cost/check.sh${updateBaselines ? " --update" : ""}`,
      heavy: true,
      kind: "zero-cost",
      why: "zero-cost scope affected",
    });
  if (
    all ||
    SIZE_LIBS.some((name) => isAffected(name)) ||
    any(files, /^templates\/|^apps\/playground\/|^apps\/(docs|cdk-docs)\/examples\/|^scripts\/size-report/)
  ) {
    if (updateBaselines) add({ id: "size:update", command: "npm run size-report -- --update", heavy: true, kind: "size", why: "--update-baselines" });
    // After an update the check measures run-to-run variance (growth within the tolerance = noise).
    add({ id: "size", command: "npm run size-report -- --check", heavy: true, kind: "size", why: "size-report scope affected" });
  }
  add({ id: "format", command: `node scripts/format-check.ts --base ${shellQuote(options.base)}`, why: "always" });
  return gates;
}

/** `--only` / `--skip` patterns: exact id, `prefix:*` / `*` globs, or a bare group (`typecheck` = `typecheck:*`). */
export function matches(id: string, pattern: string): boolean {
  if (pattern === id) return true;
  if (!pattern.includes(":") && !pattern.includes("*")) return id.startsWith(pattern + ":");
  const regex = new RegExp(
    "^" +
      pattern
        .split("*")
        .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*") +
      "$",
  );
  return regex.test(id);
}

/**
 * Narrow a plan: gates matching `only` (exact ids missing from `planned` are taken from `catalog`, the `--all` plan) plus
 * their transitive `requires`, minus `skip` matches. Order follows the catalog.
 */
export function select(planned: Gate[], catalog: Gate[], only: string[], skip: string[]): Gate[] {
  const pool = new Map<string, Gate>([...catalog, ...planned].map((g) => [g.id, g]));
  const chosen = new Set(planned.filter((g) => !only.length || only.some((p) => matches(g.id, p))).map((g) => g.id));
  for (const p of only) if (pool.has(p)) chosen.add(p);
  const queue = [...chosen];
  while (queue.length) for (const dep of pool.get(queue.pop()!)?.requires ?? []) if (!chosen.has(dep) && pool.has(dep)) (chosen.add(dep), queue.push(dep));
  for (const id of chosen) if (skip.some((p) => matches(id, p))) chosen.delete(id);
  const order = new Map(catalog.map((g, i) => [g.id, i]));
  const planIndex = new Map(planned.map((g, i) => [g.id, i]));
  return [...chosen].sort((a, b) => (order.get(a) ?? planIndex.get(a)!) - (order.get(b) ?? planIndex.get(b)!)).map((id) => pool.get(id)!);
}

function shellQuote(value: string): string {
  return /^[\w./~^@{}-]+$/.test(value) ? value : `'${value.replace(/'/g, "'\\''")}'`;
}
