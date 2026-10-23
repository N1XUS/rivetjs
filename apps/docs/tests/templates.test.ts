// The starter templates (templates/*, offered on the site and in StackBlitz) must work with the
// current packages the way a user runs them: each template's own `build` and `check` script steps,
// `tsc` over its tsconfig, its production server / preview (`start` / `preview` scripts) and `dev`.
import { strict as assert } from "node:assert";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "vitest";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../../..", import.meta.url));
const vite = resolve(repo, "node_modules/vite/bin/vite.js");
const TEMPLATES = ["starter-static", "starter-minimal", "starter-server", "starter-ui"] as const;

const scripts = (name: string) =>
  (JSON.parse(readFileSync(resolve(repo, "templates", name, "package.json"), "utf8")) as { scripts: Record<string, string> }).scripts;

/** Runs one npm script's `a && b` steps in-repo: `vite …`, `node …`, or a package bin (`rivet-check`, …). */
function runScript(name: string, script: string): string {
  const dir = resolve(repo, "templates", name);
  const command = scripts(name)[script];
  assert.ok(command, `templates/${name}: no "${script}" script`);
  let output = "";
  for (const step of command.split("&&").map((s) => s.trim())) {
    const [bin, ...args] = step.split(/\s+/);
    if (bin === "vite") output += execFileSync(process.execPath, [vite, ...args, "--logLevel", "warn"], { cwd: dir, encoding: "utf8", stdio: "pipe" });
    else if (bin === "node") output += execFileSync(process.execPath, args, { cwd: dir, encoding: "utf8", stdio: "pipe" });
    else if (/^[\w@/.-]+$/.test(bin!) && existsSync(resolve(repo, "node_modules/.bin", bin!)))
      output += execFileSync(resolve(repo, "node_modules/.bin", bin!), args, { cwd: dir, encoding: "utf8", stdio: "pipe" });
    else throw new Error(`templates/${name}: unexpected ${script} step ${step}`);
  }
  return output;
}

/** Starts a long-running script step (`node serve.js`, `vite`) and resolves with the URL it prints. */
async function serve(name: string, argv: string[], env: Record<string, string>): Promise<{ url: string; stop: () => void }> {
  const child = spawn(process.execPath, argv, { cwd: resolve(repo, "templates", name), env: { ...process.env, ...env, NO_COLOR: "1" }, stdio: "pipe" });
  let output = "";
  const url = await new Promise<string>((resolveUrl, reject) => {
    const timer = setTimeout(() => reject(new Error(`templates/${name}: no URL printed in 30 s:\n${output}`)), 30_000);
    const read = (chunk: Buffer) => {
      output += chunk;
      const match = /(http:\/\/[\w.:[\]-]+\/?)/.exec(output);
      if (match) (clearTimeout(timer), resolveUrl(match[1]!.replace(/\/?$/, "/")));
    };
    child.stdout.on("data", read);
    child.stderr.on("data", read);
    child.on("exit", (code) => (clearTimeout(timer), reject(new Error(`templates/${name}: exited ${code}:\n${output}`))));
  });
  return { url, stop: () => child.kill() };
}

for (const name of TEMPLATES) {
  test(`${name}: build, check, tsc and tsgo pass`, () => {
    runScript(name, "build");
    assert.match(runScript(name, "check"), /0 errors/);
    // Fresh-clone order matters less here: build (Vite) has written .rivet/routes.d.ts.
    execFileSync(process.execPath, [resolve(repo, "node_modules/typescript/bin/tsc"), "-p", "."], { cwd: resolve(repo, "templates", name), stdio: "pipe" });
    // TypeScript 7 native too (users on TS 6/7: `noUncheckedSideEffectImports: false` keeps CSS imports clean).
    execFileSync(process.execPath, [resolve(repo, "node_modules/@typescript/native-preview/bin/tsgo"), "-p", "."], { cwd: resolve(repo, "templates", name), stdio: "pipe" });
  });
}

test("starter-static prerenders its pages and previews them", async () => {
  const dir = resolve(repo, "templates/starter-static");
  assert.match(readFileSync(resolve(dir, "dist/client/index.html"), "utf8"), /<button/);
  assert.ok(existsSync(resolve(dir, "dist/client/about/index.html")));
  assert.equal(scripts("starter-static").preview, "node serve.js");
  const preview = await serve("starter-static", ["serve.js"], { PORT: "0" });
  try {
    const about = await fetch(new URL("about/", preview.url));
    assert.equal(about.status, 200);
    assert.match(await about.text(), /<html/);
    assert.equal((await fetch(new URL("missing/", preview.url))).status, 404);
  } finally {
    preview.stop();
  }
});

test("starter-ui prerenders @rivetjs/ui markup with the component styles", () => {
  const dir = resolve(repo, "templates/starter-ui");
  const html = readFileSync(resolve(dir, "dist/client/index.html"), "utf8");
  for (const slot of ['data-slot="card"', 'data-slot="avatar-fallback"', 'data-slot="chip"', 'data-slot="button"']) assert.ok(html.includes(slot), slot);
  assert.match(html, /<script type="rivet\/boundaries"/);
  // Two render-blocking sheets: the app stylesheet (tokens, base, utilities), then the route sheet: the stylesheets of
  // the components the page imports — one Vite asset of the route chunk (`routes-<hash>.css`, route chunks since
  // 8b748656 put the page's components into one chunk) or, when the closure still has several files, the router's merged
  // `route-<hash>.css`.
  const hrefs = [...html.matchAll(/<link rel="stylesheet" href="\/([^"]+)">/g)].map((m) => m[1]!);
  assert.equal(hrefs.length, 2, hrefs.join(", "));
  assert.match(hrefs[1]!, /^assets\/routes?-[\w-]{8}\.css$/);
  const sheets = hrefs.map((href) => readFileSync(resolve(dir, "dist/client", href), "utf8"));
  assert.ok(sheets.some((css) => css.includes("--accent")), "theme tokens");
  assert.ok(sheets.some((css) => /\.button--primary/.test(css)), "button stylesheet");
});

test("starter-minimal prerenders its page", () => {
  assert.ok(existsSync(resolve(repo, "templates/starter-minimal/dist/client/index.html")));
});

test("starter-server builds a server entry and `start` serves rendered pages", async () => {
  assert.ok(existsSync(resolve(repo, "templates/starter-server/dist/server/entry.server.js")));
  assert.equal(scripts("starter-server").start, "node serve.js");
  const server = await serve("starter-server", ["serve.js"], { PORT: "0", HOST: "127.0.0.1" });
  try {
    const home = await fetch(server.url);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /<form/);
  } finally {
    server.stop();
  }
});

test("starter-minimal `dev` serves the page", async () => {
  assert.equal(scripts("starter-minimal").dev, "vite");
  const dev = await serve("starter-minimal", [vite, "--port", "0", "--host", "127.0.0.1"], {});
  try {
    const home = await fetch(dev.url);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /<html/);
  } finally {
    dev.stop();
  }
});
