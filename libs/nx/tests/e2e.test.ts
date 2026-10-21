// End to end: a real Nx workspace under .artifacts/nx-e2e/ (gitignored) with the packaged plugin
// (`scripts/package/build.ts libs/nx` → `.artifacts/nx-e2e/dist-<pid>/nx`, linked into the workspace's node_modules;
// every other package resolves from the repository's node_modules, as the starters do in-repo). Steps: preset → build
// → test → check → typecheck → route + component generators → rebuild (new pages prerendered) → cached rebuild; a
// server app with an endpoint is built, tested and previewed over HTTP. No registry, no install.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { buildPackage } from "../../../scripts/package/build.ts";

const ROOT = resolve(import.meta.dirname, "../../..");
const BASE = join(ROOT, ".artifacts/nx-e2e");
const WS = join(BASE, `ws-${process.pid}`);
const DIST = join(BASE, `dist-${process.pid}`, "nx");
const NX = join(ROOT, "node_modules/nx/dist/bin/nx.js");
const KEEP = process.env["RIVET_NX_E2E_KEEP"] === "1";
const timings: Record<string, number> = {};

/**
 * The child environment: Nx without daemon / cloud / TUI; no Vitest variables leaking into the nested `nx test`, and no
 * outer Nx task variables (run as `nx run nx:test --skip-nx-cache`, as CI does, the outer Nx hands its task
 * `NX_SKIP_NX_CACHE=true`, `NX_WORKSPACE_ROOT`, `NX_TASK_*`: the nested workspace then never hit its cache).
 */
function env(): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) if (!/^(VITEST|TEST|NODE_ENV$|NX_|LERNA_PACKAGE_NAME$)/.test(key)) out[key] = value;
  return {
    ...out,
    NX_DAEMON: "false",
    NX_ISOLATE_PLUGINS: "false",
    NX_NO_CLOUD: "true",
    NX_TUI: "false",
    NX_INTERACTIVE: "false",
    NX_SKIP_LOG_GROUPING: "true",
    NODE_OPTIONS: "--max-old-space-size=3072",
    FORCE_COLOR: "0",
  };
}

function nx(label: string, ...args: string[]): string {
  const started = performance.now();
  const run = spawnSync(process.execPath, [NX, ...args], { cwd: WS, env: env(), encoding: "utf8", timeout: 300_000 });
  timings[label] = Math.round(performance.now() - started);
  const output = (run.stdout ?? "") + (run.stderr ?? "");
  if (run.status !== 0) throw new Error(`nx ${args.join(" ")} failed (${run.status ?? run.signal}):\n${output}`);
  return output;
}

const file = (path: string) => readFileSync(join(WS, path), "utf8");

/** A free port ≥ 4510 (never 4320–4329: other lanes' servers). */
async function freePort(from = 4510): Promise<number> {
  for (let port = from; port < from + 200; port++) {
    const ok = await new Promise<boolean>((done) => {
      const server = createServer();
      server.once("error", () => done(false));
      server.listen(port, "127.0.0.1", () => server.close(() => done(true)));
    });
    if (ok) return port;
  }
  throw new Error("no free port");
}

beforeAll(() => {
  const started = performance.now();
  rmSync(WS, { recursive: true, force: true });
  const built = buildPackage(join(ROOT, "libs/nx"), DIST);
  expect(built.warnings).toEqual([]);
  mkdirSync(join(WS, "node_modules/@rivetjs"), { recursive: true });
  symlinkSync(DIST, join(WS, "node_modules/@rivetjs/nx"), "dir");
  writeFileSync(join(WS, "package.json"), JSON.stringify({ name: "@e2e/source", version: "0.0.0", private: true, type: "module" }, null, 2) + "\n");
  writeFileSync(join(WS, "nx.json"), JSON.stringify({ $schema: "./node_modules/nx/schemas/nx-schema.json" }, null, 2) + "\n");
  writeFileSync(join(WS, ".gitignore"), "node_modules\ndist\n.nx\n");
  timings["package + workspace"] = Math.round(performance.now() - started);
}, 120_000);

afterAll(() => {
  mkdirSync(BASE, { recursive: true });
  writeFileSync(join(BASE, "timings.json"), JSON.stringify(timings, null, 2) + "\n");
  console.log("nx e2e timings (ms):", timings);
  if (!KEEP) {
    rmSync(WS, { recursive: true, force: true });
    rmSync(join(DIST, ".."), { recursive: true, force: true });
  }
});

describe("nx workspace with @rivetjs/nx", () => {
  test("preset: init + static app with inferred targets", () => {
    nx("preset", "g", "@rivetjs/nx:preset", "--name=demo", "--template=static", "--skipInstall", "--no-interactive");
    expect(JSON.parse(file("nx.json")).plugins[0].plugin).toBe("@rivetjs/nx/plugin");
    expect(JSON.parse(file("package.json")).workspaces).toEqual(["apps/*", "libs/*"]);
    const project = JSON.parse(nx("show project", "show", "project", "demo", "--json").trim().split("\n").at(-1)!);
    expect(Object.keys(project.targets)).toEqual(expect.arrayContaining(["build", "dev", "preview", "test", "check", "typecheck"]));
    expect(project.targets.build.executor).toBe("@rivetjs/nx:build");
  });

  test("build prerenders the pages; test, check and typecheck pass", () => {
    const out = nx("build", "build", "demo", "--output-style=static");
    expect(out).toContain("Prerendered 2 page(s)");
    for (const page of ["index.html", "about/index.html", "404.html"]) expect(existsSync(join(WS, "apps/demo/dist/client", page)), page).toBe(true);
    expect(file("apps/demo/dist/client/index.html")).toContain('type="rivet/state"');
    expect(nx("test", "test", "demo", "--output-style=static")).toMatch(/Tests\s+1 passed/);
    expect(nx("check", "check", "demo", "--output-style=static")).toMatch(/0 errors/);
    nx("typecheck", "typecheck", "demo", "--output-style=static");
  });

  test("route + component generators, rebuild, then a cache hit", () => {
    nx("g route", "g", "@rivetjs/nx:route", "blog/[slug]", "--project=demo", "--loader", "--layout", "--no-interactive");
    nx("g component", "g", "@rivetjs/nx:component", "Greeting", "--project=demo", "--kind=overlay", "--story", "--no-interactive");
    const out = nx("rebuild", "build", "demo", "--output-style=static");
    expect(out).toContain("Prerendered 4 page(s)");
    expect(file("apps/demo/dist/client/blog/example/index.html")).toContain("<h1>Blog Slug: example</h1>");
    expect(file("apps/demo/dist/client/stories/greeting/index.html")).toContain("Greeting");
    const cached = nx("cached build", "build", "demo", "--output-style=static");
    expect(cached).toMatch(/read the output from the cache|\[local cache\]|existing outputs match the cache/);
    // Nx replays the cached terminal output; the hit is in the summary.
    expect(cached).toMatch(/Cache:\s+1\/1 hit/);
    expect(nx("test after generators", "test", "demo", "--output-style=static")).toMatch(/Tests\s+2 passed/);
    nx("typecheck after generators", "typecheck", "demo", "--output-style=static");
  });

  test("server app: endpoint, server test, preview over HTTP", async () => {
    nx("g server app", "g", "@rivetjs/nx:application", "apps/notes", "--template=server", "--skipInstall", "--no-interactive");
    nx("g api-route", "g", "@rivetjs/nx:api-route", "api/health", "--project=notes", "--no-interactive");
    nx("build server", "build", "notes", "--output-style=static");
    expect(existsSync(join(WS, "apps/notes/dist/server/entry.server.js"))).toBe(true);
    expect(nx("test server", "test", "notes", "--output-style=static")).toMatch(/Tests\s+1 passed/);

    const port = await freePort();
    const started = performance.now();
    // Own process group: the preview (nx → executor → node serve.js) is stopped as a whole, nothing else.
    const preview = spawn(process.execPath, [NX, "preview", "notes", `--port=${port}`, "--output-style=stream"], {
      cwd: WS,
      env: env(),
      detached: true,
      stdio: "pipe",
    });
    let log = "";
    preview.stdout.on("data", (chunk) => (log += chunk));
    preview.stderr.on("data", (chunk) => (log += chunk));
    try {
      let page: Response | undefined;
      for (let i = 0; i < 150 && !page; i++) {
        page = await fetch(`http://127.0.0.1:${port}/`).catch(() => undefined);
        if (!page) await new Promise((done) => setTimeout(done, 200));
      }
      expect(page, log).toBeDefined();
      expect(page!.status).toBe(200);
      expect(await page!.text()).toContain("Notes");
      const health = await fetch(`http://127.0.0.1:${port}/api/health`);
      expect(health.status).toBe(200);
      expect(await health.json()).toMatchObject({ ok: true });
      timings["preview up + requests"] = Math.round(performance.now() - started);
    } finally {
      if (preview.pid) process.kill(-preview.pid, "SIGTERM");
    }
  });

  test("--deploy: create-rivet's platform packaging through nx build; deploy target runs the CLI from the project", () => {
    nx(
      "g vercel app",
      "g",
      "@rivetjs/nx:application",
      "apps/edge",
      "--template=server",
      "--deploy=vercel",
      "--unitTestRunner=none",
      "--skipInstall",
      "--no-interactive",
    );
    nx("build vercel", "build", "edge", "--output-style=static");
    expect(JSON.parse(file("apps/edge/.vercel/output/config.json")).version).toBe(3);
    expect(existsSync(join(WS, "apps/edge/.vercel/output/functions/_render.func/.vc-config.json"))).toBe(true);
    // A stand-in `vercel` CLI on the workspace bin path (run-commands resolves bins like npm scripts).
    mkdirSync(join(WS, "node_modules/.bin"), { recursive: true });
    writeFileSync(join(WS, "node_modules/.bin/vercel"), '#!/bin/sh\necho "$PWD $*" > "$PWD/deploy.log"\n', { mode: 0o755 });
    expect(nx("deploy vercel", "deploy", "edge", "--output-style=static")).toMatch(/Cache:\s+1\/2 hit|existing outputs match the cache/);
    expect(file("apps/edge/deploy.log").trim()).toBe(`${join(WS, "apps/edge")} deploy --prebuilt`);

    nx(
      "g cloudflare app",
      "g",
      "@rivetjs/nx:application",
      "apps/worker",
      "--template=static",
      "--deploy=cloudflare",
      "--unitTestRunner=none",
      "--skipInstall",
      "--no-interactive",
    );
    nx("build cloudflare", "build", "worker", "--output-style=static");
    const wrangler = JSON.parse(file("apps/worker/dist/cloudflare/wrangler.json"));
    expect(wrangler.compatibility_flags ?? []).not.toContain("nodejs_compat");
    expect(existsSync(join(WS, "apps/worker/dist/cloudflare/static/index.html"))).toBe(true);
    expect(JSON.parse(nx("show worker", "show", "project", "worker", "--json")).targets.deploy.options.command).toBe("wrangler deploy");
  });
});
