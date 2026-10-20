// create-rivet end to end: what a newcomer gets from `npm create rivet@latest`, without a registry.
//   1. builds the publishable packages a starter needs (+ create-rivet with its bundled templates) and packs them
//      (`npm pack`) into a scratch folder,
//   2. runs the create-rivet bin from its unpacked tarball, non-interactively, once per template
//      (`<app> --template <id> --yes --no-install --no-git`),
//   3. checks the written package.json (name, `@rivetjs/*` → the release version), then points the `@rivetjs/*`
//      dependencies at the tarballs (`file:` + `overrides`, the local stand-in for the registry),
//   4. `npm install --offline` (no network: `@rivetjs/*` from the tarballs; see INSTALL_MODE for the third-party
//      tools), `npm run build`,
//   5. starts the app's server (`start`, `preview`, or a static file server over dist/client for starters
//      without one) on a free port ≥ 4400, fetches `/` (PAGE_CHECK): interactive starters = HTML + the resume state
//      script + the inline resume bootstrap + the resume runtime file; the server starter (a loader + a form action,
//      nothing resumable) = HTML with no script at all + a form POST round trip (303 → the note on `/`); stops it.
//
//   6. per `--deploy` target (`server+<target>`, E2E_DEPLOYS): scaffold over the server starter, install, build, check
//      the platform output layout (DEPLOY_LAYOUT); nothing is deployed or started.
//
//   node scripts/package/create-e2e.ts [template | server+<target> …] [--no-build] [--keep]
//
// `--no-build` reuses packed tarballs from a `--keep` run's folder (`RIVET_E2E_WORK=<dir>`).
import { execFileSync, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { buildPackage } from "./build.ts";

const ROOT = resolve(import.meta.dirname, "../..");
/** Packages a starter installs (directly or through another package), in dependency order. */
export const E2E_PACKAGES = [
  "reactivity",
  "runtime",
  "compiler",
  "router",
  "kit",
  // @rivetjs/ui dependency (ui Form / field validation).
  "forms",
  "devtools",
  "language-core",
  "typescript-plugin",
  "cdk",
  "ui",
  "create-rivet",
];
/** create-rivet template ids (`libs/create-rivet/index.ts` `TEMPLATES`). */
export const E2E_TEMPLATES = ["minimal", "static", "server", "ui"];
/**
 * What `/` must be per template: `resume` = a resumable page (state + bootstrap + runtime file); `zero-js` = a page
 * with nothing resumable ships no script (STATIC-ZERO-JS), its form works through the action (`?/add`).
 */
export const PAGE_CHECK: Record<string, "resume" | "zero-js"> = { minimal: "resume", static: "resume", server: "zero-js", ui: "resume" };
/** `--deploy` targets, each scaffolded over the server starter (`server+<target>`): build output layout only, no deploy. */
export const E2E_DEPLOYS = ["vercel", "netlify", "cloudflare", "bun", "deno"].map((target) => `server+${target}`);
/** Platform files `npm run build` must write per target (paths relative to the app; checked after the build). */
const DEPLOY_LAYOUT: Record<string, string[]> = {
  vercel: [".vercel/output/config.json", ".vercel/output/functions/_render.func/.vc-config.json"],
  netlify: ["netlify.toml", "dist/netlify", ".netlify/v1/config.json", ".netlify/v1/functions/rivet-server/rivet-server.mjs"],
  cloudflare: ["dist/cloudflare/wrangler.json", "dist/server/worker.js", ".wrangler/deploy/config.json"],
  bun: ["dist/server/bun.js"],
  deno: ["dist/server/deno.js"],
};
/** Tools a scaffold lists that the build does not run (`wrangler`: preview / deploy only): not linked when absent. */
const BUILD_UNUSED = new Set(["wrangler"]);
/**
 * How the app's third-party packages arrive (`RIVET_E2E_INSTALL`); `@rivetjs/*` always come from the tarballs:
 * - `linked` (default): the app's own third-party dependencies (vite, typescript, tailwindcss, lucide, …) are left
 *   out of the install and symlinked from the workspace `node_modules` (same versions the repo tests with);
 *   `npm install --offline --legacy-peer-deps` installs the tarballs + their third-party dependencies from the npm
 *   cache. Deterministic, no network (CI: see LINKED_FLAG).
 * - `offline`: the whole package.json, `npm install --offline` (fails with ENOTCACHED when a range resolves to a
 *   version the local cache never saw).
 * - `online`: the whole package.json, `npm install --prefer-offline` (registry reads allowed; nothing is published).
 */
export const INSTALL_MODE = (process.env["RIVET_E2E_INSTALL"] ?? "linked") as "linked" | "offline" | "online";
/**
 * `linked` install flag: `--offline` locally; under CI (`CI` set) `--prefer-offline`, because `npm ci` fills the cache
 * with tarballs but not the package metadata an install of the tarballs' own dependencies (svgo, tailwind-variants, …)
 * needs. Registry reads only; `@rivetjs/*` still come from the tarballs (`file:` + `overrides`).
 */
const LINKED_FLAG = process.env["CI"] ? "--prefer-offline" : "--offline";
/** Never these (other local services). */
const RESERVED = new Set([4320, 4321, 4322, 4323, 4324, 4325, 4326]);

export interface TemplateResult {
  template: string;
  ok: boolean;
  steps: string[];
  error?: string;
  ms: number;
}

/** A free TCP port ≥ `from` (skipping {@link RESERVED}). */
export async function freePort(from = 4400): Promise<number> {
  for (let port = from; port < 65535; port++) {
    if (RESERVED.has(port)) continue;
    const free = await new Promise<boolean>((done) => {
      const server = createNetServer();
      server.once("error", () => done(false));
      server.listen(port, "127.0.0.1", () => server.close(() => done(true)));
    });
    if (free) return port;
  }
  throw new Error("no free port");
}

const run = (command: string, args: string[], cwd: string, env: Record<string, string> = {}) => {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "", NO_COLOR: "1", ...env }, maxBuffer: 64 << 20 });
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(" ")} (in ${cwd}) exited ${result.status}:\n${(result.stderr || result.stdout).trim().split("\n").slice(-25).join("\n")}`,
    );
  return result.stdout;
};

/** Builds + packs {@link E2E_PACKAGES} into `<work>/tarballs`; returns name → tarball path. */
export function packPackages(work: string, { build = true } = {}): Map<string, string> {
  const tarballs = join(work, "tarballs");
  const dist = join(work, "dist");
  mkdirSync(tarballs, { recursive: true });
  const out = new Map<string, string>();
  for (const name of E2E_PACKAGES) {
    const at = join(dist, name);
    if (build) {
      // Libs with their own build step (`libs/<name>/build.ts`: typescript-plugin's `publishConfig.prebuilt` bundle, devtools'
      // panel UI in `dist/ui`) need it run first on a fresh checkout (CI); the output dir is `prebuilt` or `dist`.
      const source = JSON.parse(readFileSync(join(ROOT, "libs", name, "package.json"), "utf8")) as { publishConfig?: { prebuilt?: string } };
      const buildScript = join(ROOT, "libs", name, "build.ts");
      if (existsSync(buildScript) && !existsSync(join(ROOT, "libs", name, source.publishConfig?.prebuilt ?? "dist")))
        run(process.execPath, [buildScript], ROOT);
      const result = buildPackage(join("libs", name), at, { typecheck: false });
      if (result.warnings.length) throw new Error(`build ${name}:\n${result.warnings.join("\n")}`);
    }
    const manifest = JSON.parse(readFileSync(join(at, "package.json"), "utf8")) as { name: string; version: string };
    const file = join(tarballs, `${manifest.name.replace(/^@/, "").replace("/", "-")}-${manifest.version}.tgz`);
    if (build || !existsSync(file)) execFileSync("npm", ["pack", at, "--pack-destination", tarballs, "--silent"], { cwd: ROOT, encoding: "utf8" });
    if (!existsSync(file)) throw new Error(`npm pack ${name}: ${file} missing`);
    out.set(manifest.name, file);
  }
  return out;
}

/** Serves `dir` (folders → index.html) on `port`: the stand-in static host for starters without a server script. */
export function staticServer(dir: string, port: number): Promise<Server> {
  const types: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? "/", "http://x").pathname);
    const file = join(dir, path.endsWith("/") ? path + "index.html" : path);
    if (!file.startsWith(dir) || !existsSync(file)) return response.writeHead(404).end("Not found");
    response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
  });
  return new Promise((done) => server.listen(port, "127.0.0.1", () => done(server)));
}

/** Waits until `url` answers (or the child exits / 30 s pass). */
export async function waitFor(url: string, child?: ChildProcess, log?: () => string): Promise<void> {
  const until = Date.now() + 30_000;
  for (;;) {
    if (child && child.exitCode !== null) throw new Error(`server exited ${child.exitCode}:\n${log?.()}`);
    try {
      await fetch(url);
      return;
    } catch {
      if (Date.now() > until) throw new Error(`no answer from ${url} in 30 s:\n${log?.()}`);
      await new Promise((done) => setTimeout(done, 200));
    }
  }
}

/** Asserts a JS-free Rivet page at `base` whose `?/add` form action round-trips; returns a short description. */
export async function checkZeroJs(base: string): Promise<string> {
  const response = await fetch(base);
  const html = await response.text();
  if (response.status !== 200) throw new Error(`GET / → ${response.status}`);
  if (!/^<!doctype html><html/i.test(html)) throw new Error(`GET / is not an HTML document: ${html.slice(0, 200)}`);
  if (/<script\b|rel="?modulepreload/i.test(html)) throw new Error("GET /: a page with nothing resumable ships a script or modulepreload");
  if (!/<form method="post" action="\?\/add"/.test(html)) throw new Error("GET /: no `?/add` form");
  const note = `e2e note ${Date.now()}`;
  const posted = await fetch(new URL("?/add", base), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: new URL(base).origin },
    body: new URLSearchParams({ text: note }),
    redirect: "manual",
  });
  if (posted.status !== 303 || posted.headers.get("location") !== "/") throw new Error(`POST ?/add → ${posted.status} ${posted.headers.get("location")}`);
  const after = await (await fetch(base)).text();
  if (!after.includes(`<li>${note}</li>`)) throw new Error("GET / after POST ?/add: the note is not listed");
  return `GET / 200 (${(html.length / 1024).toFixed(1)} KB, no script), POST ?/add 303 → / lists the note`;
}

/** Asserts a resumable Rivet page at `base` and returns a short description. */
export async function checkPage(base: string): Promise<string> {
  const response = await fetch(base);
  const html = await response.text();
  if (response.status !== 200) throw new Error(`GET / → ${response.status}`);
  if (!/^<!doctype html><html/i.test(html)) throw new Error(`GET / is not an HTML document: ${html.slice(0, 200)}`);
  const state = /<script type="rivet\/state"[^>]*>(\{.*?\})<\/script><script(?: nonce="[^"]+")?>\(function\(\)\{/.exec(html);
  if (!state) throw new Error("GET /: no resume state script + inline resume bootstrap");
  const { rt } = JSON.parse(state[1]!) as { rt?: string };
  if (!rt) throw new Error("resume state names no runtime (`rt`)");
  const runtime = await fetch(new URL(rt, base));
  if (runtime.status !== 200 || !/javascript/.test(runtime.headers.get("content-type") ?? ""))
    throw new Error(`GET ${rt} → ${runtime.status} ${runtime.headers.get("content-type")}`);
  return `GET / 200 (${(html.length / 1024).toFixed(1)} KB, resume state + bootstrap), GET ${rt} 200`;
}

/** One template: create from the unpacked create-rivet tarball, install offline, build, serve, fetch. */
export async function runTemplate(entry: string, work: string, tarballs: Map<string, string>, cli: string): Promise<TemplateResult> {
  const template = entry;
  const [id, deploy] = entry.split("+") as [string, string | undefined];
  const started = performance.now();
  const steps: string[] = [];
  const apps = join(work, "apps");
  mkdirSync(apps, { recursive: true });
  const name = `e2e-${id}${deploy ? "-" + deploy : ""}-app`;
  const app = join(apps, name);
  rmSync(app, { recursive: true, force: true });
  let child: ChildProcess | undefined;
  let server: Server | undefined;
  try {
    const created = run(process.execPath, [cli, name, "--template", id, ...(deploy ? ["--deploy", deploy] : []), "--yes", "--no-install", "--no-git"], apps, {
      npm_config_user_agent: "npm/11",
    });
    if (!/Created/.test(created)) throw new Error(`create-rivet printed no "Created":\n${created}`);
    steps.push("create-rivet");
    const pkg = JSON.parse(readFileSync(join(app, "package.json"), "utf8")) as {
      name: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      overrides?: Record<string, string>;
      scripts: Record<string, string>;
    };
    const version = JSON.parse(readFileSync(join(ROOT, "libs/create-rivet/package.json"), "utf8")).version as string;
    const expected = version.includes("-") ? version : "^" + version;
    if (pkg.name !== name) throw new Error(`package.json name ${pkg.name}, expected ${name}`);
    for (const deps of [pkg.dependencies ?? {}, pkg.devDependencies ?? {}])
      for (const [dep, spec] of Object.entries(deps)) {
        if (!dep.startsWith("@rivetjs/")) continue;
        if (spec !== expected) throw new Error(`${dep}: "${spec}", expected "${expected}"`);
        const tarball = tarballs.get(dep);
        if (!tarball) throw new Error(`${dep}: no tarball (add it to E2E_PACKAGES)`);
        deps[dep] = "file:" + tarball;
      }
    if (!existsSync(join(app, ".gitignore"))) throw new Error(".gitignore missing (bundled as _gitignore)");
    pkg.overrides = Object.fromEntries([...tarballs].filter(([dep]) => dep.startsWith("@rivetjs/")).map(([dep, file]) => [dep, "file:" + file]));
    writeFileSync(join(app, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
    steps.push(`package.json ok (@rivetjs/* ${expected})`);

    if (INSTALL_MODE === "linked") {
      const linked: string[] = [];
      const install = structuredClone(pkg);
      for (const deps of [install.dependencies ?? {}, install.devDependencies ?? {}])
        for (const dep of Object.keys(deps))
          if (!dep.startsWith("@rivetjs/")) {
            delete deps[dep];
            linked.push(dep);
          }
      // The tarballs' own third-party dependencies (devtools → lucide, i18n → @formatjs/*, …) come from the workspace
      // install too (npm links a `file:` directory): an npm cache that never saw them does not fail the offline install.
      install.dependencies ??= {};
      install.overrides ??= {};
      for (const file of new Set(tarballs.values())) {
        const manifest = JSON.parse(execFileSync("tar", ["-xOzf", file, "package/package.json"], { encoding: "utf8" })) as {
          dependencies?: Record<string, string>;
        };
        for (const dep of Object.keys(manifest.dependencies ?? {}))
          if (!dep.startsWith("@rivetjs/") && existsSync(join(ROOT, "node_modules", dep, "package.json")))
            install.dependencies[dep] = install.overrides[dep] = "file:" + join(ROOT, "node_modules", dep);
      }
      writeFileSync(join(app, "package.json"), JSON.stringify(install, null, 2) + "\n");
      run("npm", ["install", LINKED_FLAG, "--legacy-peer-deps", "--no-audit", "--no-fund", "--loglevel=error"], app);
      writeFileSync(join(app, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
      for (const dep of linked) {
        const from = join(ROOT, "node_modules", dep);
        const to = join(app, "node_modules", dep);
        if (!existsSync(from) && BUILD_UNUSED.has(dep)) continue;
        if (!existsSync(from)) throw new Error(`${dep}: not in the workspace node_modules (RIVET_E2E_INSTALL=offline|online installs it)`);
        if (existsSync(to)) continue;
        mkdirSync(dirname(to), { recursive: true });
        symlinkSync(from, to);
        // Their bins (`vite`, `tsc`) as npm would link them.
        const { name: binName, bin } = JSON.parse(readFileSync(join(from, "package.json"), "utf8")) as { name: string; bin?: string | Record<string, string> };
        const bins = typeof bin === "string" ? { [binName.split("/").pop()!]: bin } : (bin ?? {});
        mkdirSync(join(app, "node_modules/.bin"), { recursive: true });
        for (const [command, file] of Object.entries(bins)) {
          const link = join(app, "node_modules/.bin", command);
          if (!existsSync(link)) symlinkSync(join(from, file), link);
        }
      }
      steps.push(
        `npm install ${LINKED_FLAG} (tarballs; linked from the workspace: ${linked.filter((dep) => existsSync(join(ROOT, "node_modules", dep))).join(", ")})`,
      );
    } else {
      const flag = INSTALL_MODE === "online" ? "--prefer-offline" : "--offline";
      run("npm", ["install", flag, "--no-audit", "--no-fund", "--loglevel=error"], app);
      steps.push(`npm install ${flag}`);
    }
    run("npm", ["run", "build"], app);
    if (!existsSync(join(app, "dist/client"))) throw new Error("npm run build wrote no dist/client");
    steps.push("npm run build");

    if (deploy) {
      const expected = DEPLOY_LAYOUT[deploy];
      if (!expected) throw new Error(`no layout for deploy target ${deploy}`);
      const config = readFileSync(join(app, "vite.config.ts"), "utf8");
      if (!config.includes(`adapter: "${deploy}"`)) throw new Error(`vite.config.ts has no adapter "${deploy}"`);
      const missing = expected.filter((file) => !existsSync(join(app, file)));
      if (missing.length) throw new Error(`${deploy} build output missing: ${missing.join(", ")}`);
      if (deploy === "cloudflare" && /nodejs_compat"/.test(readFileSync(join(app, "dist/cloudflare/wrangler.json"), "utf8").replace(/no_nodejs_compat/g, "")))
        throw new Error("wrangler.json enables nodejs_compat");
      steps.push(`${deploy} layout: ${expected.join(", ")}`);
      return { template, ok: true, steps, ms: Math.round(performance.now() - started) };
    }

    const port = await freePort();
    const base = `http://127.0.0.1:${port}/`;
    const script = pkg.scripts["start"] ?? pkg.scripts["preview"];
    if (script) {
      const [tool, ...args] = script.split(/\s+/);
      if (tool !== "node") throw new Error(`unexpected server script "${script}"`);
      let log = "";
      child = spawn(process.execPath, args, { cwd: app, env: { ...process.env, NODE_OPTIONS: "", PORT: String(port), HOST: "127.0.0.1" }, stdio: "pipe" });
      child.stdout!.on("data", (chunk) => (log += chunk));
      child.stderr!.on("data", (chunk) => (log += chunk));
      await waitFor(base, child, () => log);
      steps.push(`${script} on :${port}`);
    } else {
      server = await staticServer(join(app, "dist/client"), port);
      steps.push(`static server over dist/client on :${port}`);
    }
    steps.push(await (PAGE_CHECK[template] === "zero-js" ? checkZeroJs(base) : checkPage(base)));
    return { template, ok: true, steps, ms: Math.round(performance.now() - started) };
  } catch (error) {
    return { template, ok: false, steps, error: (error as Error).message, ms: Math.round(performance.now() - started) };
  } finally {
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise((done) => (child!.exitCode !== null ? done(null) : child!.once("exit", done)));
    }
    if (server) await new Promise((done) => server!.close(done));
  }
}

/** Packs, unpacks create-rivet, runs every template. */
export async function createE2E({ templates = [...E2E_TEMPLATES, ...E2E_DEPLOYS], build = true, keep = false, work = process.env["RIVET_E2E_WORK"] } = {}) {
  const dir = work ?? mkdtempSync(join(tmpdir(), "rivet-create-e2e-"));
  try {
    const tarballs = packPackages(dir, { build });
    const unpacked = join(dir, "create-rivet");
    rmSync(unpacked, { recursive: true, force: true });
    mkdirSync(unpacked);
    execFileSync("tar", ["-xzf", tarballs.get("create-rivet")!, "-C", unpacked]);
    const cli = join(unpacked, "package", "cli.js");
    const bundled = readdirSync(join(unpacked, "package", "templates")).sort();
    const results: TemplateResult[] = [];
    for (const template of templates) results.push(await runTemplate(template, dir, tarballs, cli));
    return { work: dir, bundled, results };
  } finally {
    if (!keep && !work) rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((arg) => arg.startsWith("--")));
  const names = args.filter((arg) => !arg.startsWith("--"));
  const { work, bundled, results } = await createE2E({
    templates: names.length ? names : [...E2E_TEMPLATES, ...E2E_DEPLOYS],
    build: !flags.has("--no-build"),
    keep: flags.has("--keep"),
  });
  console.log(`create-rivet templates: ${bundled.join(", ")}`);
  for (const result of results) {
    console.log(`${result.ok ? "ok  " : "FAIL"} ${result.template} (${(result.ms / 1000).toFixed(1)} s)\n  ${result.steps.join("\n  ")}`);
    if (result.error) console.log("  " + result.error.replaceAll("\n", "\n  "));
  }
  if (flags.has("--keep")) console.log("kept " + work);
  if (results.some((result) => !result.ok)) process.exit(1);
}
