// The real publish path, end to end, against a local registry (Verdaccio, `scripts/release/verdaccio.ts`):
//
//   node scripts/release/local-e2e.ts [templates…] [--bump minor] [--port 4873] [--work <dir>] [--full] [--skip-package] [--keep-running]
//
//   1. starts a fresh Verdaccio (storage under scripts/release/verdaccio/storage/, gitignored) + a throwaway user
//   2. `release.ts <bump> --registry <local>`: packages every lib, bumps the dist manifests, publishes them for real —
//      to the local registry only (release.ts refuses any non-localhost `--registry`); `--full` also runs its tarball
//      smoke + create-rivet e2e steps
//   3. per template: `npm create rivet@latest <app> -- --template <t> --yes --no-git` in `--work` (default: a temp dir),
//      which installs from the local registry (third-party packages are proxied from npmjs through it)
//   4. `npm run build`, `npm run check`, then the server (`start` / `preview`) or a static server over dist/client,
//      and the same page checks as scripts/package/create-e2e.ts
//   5. prints a report; stops Verdaccio (unless `--keep-running`)
//
// npm only ever reads storage/npmrc (`--userconfig` + `NPM_CONFIG_USERCONFIG`, `--@rivetjs:registry`): registry, the
// throwaway token, cache in storage/; `assertNpmTargets` checks that before anything runs.
// The user's ~/.npmrc and ~/.npm are never read or written. Real npmjs publishes stay CI-only (`release.ts --publish`).
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { checkPage, checkZeroJs, E2E_TEMPLATES, freePort, PAGE_CHECK, staticServer, waitFor } from "../package/create-e2e.ts";
import { assertLocalRegistry, assertNpmTargets, DEFAULT_PORT, localNpmArgs, localNpmEnv, ROOT, start, stop, STORAGE, userconfig } from "./verdaccio.ts";

interface Result {
  template: string;
  ok: boolean;
  steps: string[];
  error?: string;
  ms: number;
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    bump: { type: "string", default: "minor" },
    port: { type: "string" },
    work: { type: "string" },
    full: { type: "boolean", default: false },
    "skip-package": { type: "boolean", default: false },
    "keep-running": { type: "boolean", default: false },
  },
});
const templates = positionals.length ? positionals : E2E_TEMPLATES;

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): string {
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  const out = (result.stdout ?? "") + (result.stderr ?? "");
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} (exit ${result.status}):\n${out.slice(-4000)}`);
  return out;
}

async function template(id: string, work: string, env: NodeJS.ProcessEnv, npmArgs: string[], version: string): Promise<Result> {
  const started = performance.now();
  const steps: string[] = [];
  const name = `my-${id}-app`;
  const app = join(work, name);
  rmSync(app, { recursive: true, force: true });
  let child: ChildProcess | undefined;
  let server: Server | undefined;
  try {
    const t0 = performance.now();
    run("npm", ["create", "rivet@latest", ...npmArgs, name, "--", "--template", id, "--yes", "--no-git"], work, env);
    if (!existsSync(join(app, "node_modules/@rivetjs/runtime/package.json"))) throw new Error("npm create installed no @rivetjs/runtime");
    const installed = (JSON.parse(readFileSync(join(app, "node_modules/@rivetjs/runtime/package.json"), "utf8")) as { version: string }).version;
    if (installed !== version) throw new Error(`installed @rivetjs/runtime ${installed}, published ${version}`);
    steps.push(`npm create rivet@latest + install (@rivetjs/* ${installed}) ${((performance.now() - t0) / 1000).toFixed(1)} s`);
    run("npm", ["run", "build"], app, env);
    steps.push("npm run build");
    run("npm", ["run", "check"], app, env);
    steps.push("npm run check");

    const pkg = JSON.parse(readFileSync(join(app, "package.json"), "utf8")) as { scripts: Record<string, string> };
    const port = await freePort();
    const base = `http://127.0.0.1:${port}/`;
    const script = pkg.scripts["start"] ?? pkg.scripts["preview"];
    if (script) {
      const [tool, ...args] = script.split(/\s+/);
      if (tool !== "node") throw new Error(`unexpected server script "${script}"`);
      let log = "";
      child = spawn(process.execPath, args, { cwd: app, env: { ...env, NODE_OPTIONS: "", PORT: String(port), HOST: "127.0.0.1" }, stdio: "pipe" });
      child.stdout!.on("data", (chunk) => (log += chunk));
      child.stderr!.on("data", (chunk) => (log += chunk));
      await waitFor(base, child, () => log);
      steps.push(`${script} on :${port}`);
    } else {
      server = await staticServer(join(app, "dist/client"), port);
      steps.push(`static server over dist/client on :${port}`);
    }
    steps.push(await (PAGE_CHECK[id] === "zero-js" ? checkZeroJs(base) : checkPage(base)));
    return { template: id, ok: true, steps, ms: Math.round(performance.now() - started) };
  } catch (error) {
    return { template: id, ok: false, steps, error: (error as Error).message, ms: Math.round(performance.now() - started) };
  } finally {
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise((done) => (child!.exitCode !== null ? done(null) : child!.once("exit", done)));
    }
    if (server) await new Promise((done) => server!.close(done));
  }
}

let failed = false;
try {
  const url = await start({ port: Number(values.port ?? DEFAULT_PORT), fresh: true });
  assertLocalRegistry(url);
  const npmrc = await userconfig(url);
  console.log(`verdaccio: ${url} (userconfig ${npmrc})`);
  // Only the project userconfig: no ~/.npmrc, no ~/.npm cache, no global config.
  const env: NodeJS.ProcessEnv = {
    ...localNpmEnv(npmrc, Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^npm_/i.test(key)))),
    NPM_CONFIG_REGISTRY: url,
    NPM_CONFIG_CACHE: join(STORAGE, "npm-cache"),
    NPM_CONFIG_UPDATE_NOTIFIER: "false",
    NPM_CONFIG_FUND: "false",
    NPM_CONFIG_AUDIT: "false",
    NX_DAEMON: "false",
    NX_ISOLATE_PLUGINS: "false",
  };
  const npmArgs = localNpmArgs(url, npmrc);
  // Same pre-flight as release.ts: npm resolves both registries to the local one, reads only storage/npmrc.
  assertNpmTargets(url, npmArgs, env, npmrc);

  const release = [
    "scripts/release/release.ts",
    values.bump!,
    "--tag",
    "latest",
    "--registry",
    url,
    ...(values.full ? [] : ["--skip-smoke", "--skip-e2e"]),
    ...(values["skip-package"] ? ["--skip-package"] : []),
  ];
  const t0 = performance.now();
  const published = run(process.execPath, release, ROOT, env);
  const version = /published (\S+) to /.exec(published)?.[1];
  if (!version) throw new Error(`release.ts printed no "published <version> to":\n${published.slice(-4000)}`);
  console.log(`published ${version} to ${url} in ${((performance.now() - t0) / 1000).toFixed(1)} s`);

  const work = values.work ?? mkdtempSync(join(tmpdir(), "rivet-local-e2e-"));
  mkdirSync(work, { recursive: true });
  for (const id of templates) {
    const result = await template(id, work, env, npmArgs, version);
    console.log(`${result.ok ? "ok  " : "FAIL"} ${result.template} (${(result.ms / 1000).toFixed(1)} s)\n  ${result.steps.join("\n  ")}`);
    if (result.error) console.log("  " + result.error.replaceAll("\n", "\n  "));
    failed ||= !result.ok;
  }
  console.log(`apps in ${work}`);
} catch (error) {
  console.error(`local-e2e: ${(error as Error).message}`);
  failed = true;
} finally {
  if (!values["keep-running"]) await stop();
}
if (failed) process.exit(1);
