// create-rivet: helpers, project creation from the repo templates, bundling, prompts and the non-interactive CLI.
import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import { stripVTControlCharacters } from "node:util";
import { afterAll, test } from "vitest";
import { bundleTemplates } from "../bundle.ts";
import {
  commands,
  copyTemplateDir,
  createProject,
  detectPackageManager,
  findTemplate,
  isEmptyDir,
  overlayDir,
  ownVersion,
  rewriteManifest,
  TEMPLATES,
  templatesRoot,
  toPackageName,
  validatePackageName,
  versionRange,
} from "../index.ts";
import { addAdapter, DEPLOY_TARGETS, deployOverlay, deployProblem, WRANGLER_RANGE } from "../deploy.ts";
import { HELP, main, type MainIO } from "../main.ts";
import { closePrompts, confirm, PromptCancelled, select, text } from "../prompt.ts";

const scratch = mkdtempSync(join(tmpdir(), "create-rivet-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
const repoTemplates = resolve(import.meta.dirname, "../../../templates");

function io(lines: string[] = [], tty = false): MainIO & { out: () => string; err: () => string } {
  const input = new PassThrough() as PassThrough & { isTTY?: boolean };
  if (tty) input.isTTY = true;
  for (const line of lines) input.write(line + "\n");
  let out = "";
  let err = "";
  const output = new PassThrough();
  output.on("data", (chunk) => (out += chunk));
  const error = new PassThrough();
  error.on("data", (chunk) => (err += chunk));
  // styleText reads process.env (FORCE_COLOR set by nx / CI wins over `env`): compare the text without ANSI styling.
  return { input, output, error, cwd: scratch, env: { NO_COLOR: "1" }, out: () => stripVTControlCharacters(out), err: () => stripVTControlCharacters(err) };
}

test("every offered template exists in templates/ with a package.json", () => {
  assert.equal(templatesRoot(), repoTemplates);
  assert.deepEqual(
    TEMPLATES.map((t) => t.id),
    ["static", "server", "ui", "minimal"],
  );
  for (const { dir } of TEMPLATES) assert.ok(existsSync(join(repoTemplates, dir, "package.json")), dir);
  assert.equal(findTemplate("ui")?.dir, "starter-ui");
  assert.equal(findTemplate("starter-server")?.id, "server");
  assert.equal(findTemplate("nope"), undefined);
});

test("names: folder → package name, npm name rules", () => {
  assert.equal(toPackageName("My App"), "my-app");
  assert.equal(toPackageName("  .hidden_Thing!! "), "hidden_thing");
  assert.equal(toPackageName("***"), "rivet-app");
  assert.equal(validatePackageName("my-app"), undefined);
  assert.equal(validatePackageName("@me/app"), undefined);
  assert.ok(validatePackageName("My App"));
  assert.ok(validatePackageName(""));
  assert.ok(validatePackageName("a".repeat(215)));
});

test("package manager from the user agent; commands per manager", () => {
  assert.equal(detectPackageManager("pnpm/9.12.0 npm/? node/v24.0.0 darwin arm64"), "pnpm");
  assert.equal(detectPackageManager("yarn/4.5.0 npm/? node/v24.0.0"), "yarn");
  assert.equal(detectPackageManager("bun/1.2.0 npm/? node/v24.0.0"), "bun");
  assert.equal(detectPackageManager("npm/11.0.0 node/v24.0.0"), "npm");
  assert.equal(detectPackageManager(""), "npm");
  assert.equal(commands("npm").install, "npm install");
  assert.equal(commands("yarn").install, "yarn");
  assert.equal(commands("pnpm").run("dev"), "pnpm dev");
  assert.equal(commands("bun").run("dev"), "bun run dev");
  assert.equal(commands("npm").run("dev"), "npm run dev");
});

test("version range: exact for prereleases, caret otherwise; own version from package.json", () => {
  assert.equal(versionRange("0.1.0"), "^0.1.0");
  assert.equal(versionRange("0.1.0-alpha.2"), "0.1.0-alpha.2");
  assert.equal(ownVersion(), JSON.parse(readFileSync(resolve(import.meta.dirname, "../package.json"), "utf8")).version);
});

test("manifest rewrite: name, version, every @rivetjs/* spec (dist-tag, workspace:, file:, link:) → the release range", () => {
  const out = rewriteManifest(
    {
      name: "rivet-starter-x",
      version: "0.0.0",
      private: true,
      dependencies: { "@rivetjs/router": "experimental", "@rivetjs/runtime": "workspace:*", lucide: "^1.52.0" },
      devDependencies: { "@rivetjs/compiler": "file:../../libs/compiler", "@rivetjs/devtools": "link:../x", vite: "^8.3.2" },
    },
    "my-app",
    "^0.2.0",
  );
  assert.deepEqual(out, {
    name: "my-app",
    version: "0.1.0",
    private: true,
    dependencies: { "@rivetjs/router": "^0.2.0", "@rivetjs/runtime": "^0.2.0", lucide: "^1.52.0" },
    devDependencies: { "@rivetjs/compiler": "^0.2.0", "@rivetjs/devtools": "^0.2.0", vite: "^8.3.2" },
  });
});

test("createProject: every template copies its source files (no dist / node_modules / .rivet / .stackblitzrc) and rewrites package.json", () => {
  for (const { id, dir } of TEMPLATES) {
    const target = join(scratch, "projects", id);
    const result = createProject({ dir: target, template: id, rivetVersion: "1.2.3" });
    assert.equal(result.name, id);
    assert.ok(result.files.includes("package.json") && result.files.includes(".gitignore") && result.files.includes("vite.config.ts"), id);
    assert.ok(
      result.files.some((file) => file.startsWith("src/routes/")),
      id,
    );
    assert.ok(!result.files.some((file) => /(^|\/)(node_modules|dist|\.rivet)\/|\.stackblitzrc/.test(file)), id);
    const pkg = JSON.parse(readFileSync(join(target, "package.json"), "utf8"));
    const source = JSON.parse(readFileSync(join(repoTemplates, dir, "package.json"), "utf8"));
    assert.equal(pkg.name, id);
    assert.deepEqual(pkg.scripts, source.scripts);
    for (const field of ["dependencies", "devDependencies"])
      for (const [dep, spec] of Object.entries(pkg[field] as Record<string, string>))
        assert.equal(spec, dep.startsWith("@rivetjs/") ? "1.2.3" : source[field][dep], `${id} ${dep}`);
  }
  assert.throws(() => createProject({ dir: join(scratch, "bad"), template: "nope" as "ui" }), /Unknown template "nope"/);
});

test("overlays (extension point, e.g. a deploy target): files over the template, then a manifest edit", () => {
  const overlay = join(scratch, "overlay");
  mkdirSync(join(overlay, "deploy"), { recursive: true });
  writeFileSync(join(overlay, "deploy", "config.json"), "{}\n");
  writeFileSync(join(overlay, "_gitignore"), "node_modules/\n.deploy/\n");
  const target = join(scratch, "projects", "overlaid");
  const result = createProject({
    dir: target,
    template: "minimal",
    overlays: [{ name: "test", dir: overlay, manifest: (pkg) => ({ ...pkg, scripts: { ...(pkg["scripts"] as object), deploy: "node deploy.js" } }) }],
  });
  assert.ok(result.files.includes("deploy/config.json"));
  assert.match(readFileSync(join(target, ".gitignore"), "utf8"), /\.deploy\//);
  assert.equal(JSON.parse(readFileSync(join(target, "package.json"), "utf8")).scripts.deploy, "node deploy.js");
});

test("bundle: templates copied for the package, .gitignore shipped as _gitignore and renamed back on create", () => {
  const out = join(scratch, "bundle");
  const files = bundleTemplates(out);
  for (const { dir } of TEMPLATES) {
    assert.ok(files.includes(`${dir}/package.json`), dir);
    assert.ok(files.includes(`${dir}/_gitignore`), dir);
    assert.ok(!files.includes(`${dir}/.gitignore`), dir);
  }
  assert.ok(!files.some((file) => /\/(node_modules|dist|\.rivet)\//.test(file)));
  const copied = copyTemplateDir(join(out, "templates", "starter-minimal"), join(scratch, "from-bundle"));
  assert.ok(copied.includes(".gitignore") && !copied.includes("_gitignore"));
  assert.equal(readFileSync(join(scratch, "from-bundle", ".gitignore"), "utf8"), readFileSync(join(repoTemplates, "starter-minimal", ".gitignore"), "utf8"));
});

test("bundle: overlay folders (templates/_<name>) ship too; overlayDir finds them", () => {
  const from = join(scratch, "fake-templates");
  for (const { dir } of TEMPLATES) {
    mkdirSync(join(from, dir, "node_modules", "x"), { recursive: true });
    writeFileSync(join(from, dir, "package.json"), "{}\n");
    writeFileSync(join(from, dir, "node_modules", "x", "index.js"), "");
  }
  mkdirSync(join(from, "_deploy-test"), { recursive: true });
  writeFileSync(join(from, "_deploy-test", ".gitignore"), ".deploy/\n");
  writeFileSync(join(from, "_deploy-test", "deploy.json"), "{}\n");
  mkdirSync(join(from, "not-offered"));
  writeFileSync(join(from, "not-offered", "package.json"), "{}\n");
  const files = bundleTemplates(join(scratch, "bundle-fake"), from);
  assert.deepEqual(files, [...TEMPLATES.map((t) => `${t.dir}/package.json`), "_deploy-test/_gitignore", "_deploy-test/deploy.json"].sort());
  assert.equal(overlayDir("deploy-vercel"), join(repoTemplates, "_deploy-vercel"));
});

test("prompts: text default + validation, confirm, numbered select (not a TTY), cancel on end of input", async () => {
  const p = io(["", "Bad Name", "good", "", "n", "maybe", "y", "3", "", "server"]);
  assert.equal(await text(p, "Name:", "fallback"), "fallback");
  assert.equal(await text(p, "Name:", "x", (value) => (/\s/.test(value) ? "no spaces" : undefined)), "good");
  assert.match(p.out(), /no spaces/);
  assert.equal(await confirm(p, "Install?", true), true);
  assert.equal(await confirm(p, "Install?", true), false);
  assert.equal(await confirm(p, "Install?", false), true);
  const choices = TEMPLATES.map((t) => ({ value: t.id, label: t.label }));
  assert.equal(await select(p, "Template:", choices), "ui");
  assert.equal(await select(p, "Template:", choices, 1), "server");
  assert.equal(await select(p, "Template:", choices), "server");
  (p.input as PassThrough).end();
  await assert.rejects(text(p, "Name:", "x"), PromptCancelled);
  closePrompts(p);
});

test("cli: --help, --version, bad flags", async () => {
  let p = io();
  assert.equal(await main(["--help"], p), 0);
  assert.equal(p.out(), HELP);
  for (const { id } of TEMPLATES) assert.match(HELP, new RegExp(`--template|${id}`));
  p = io();
  assert.equal(await main(["-v"], p), 0);
  assert.equal(p.out().trim(), ownVersion());
  p = io();
  assert.equal(await main(["x", "--template", "vue"], p), 1);
  assert.match(p.err(), /Unknown template "vue"/);
  p = io();
  assert.equal(await main(["x", "--pm", "deno"], p), 1);
  assert.match(p.err(), /Unknown package manager/);
  p = io();
  assert.equal(await main(["--bogus"], p), 1);
  assert.match(p.err(), /bogus/);
});

test("cli non-interactive: --yes --no-install --no-git writes the project and prints next steps", async () => {
  const p = io();
  assert.equal(await main(["cli-app", "--template", "server", "--yes", "--no-install", "--no-git", "--pm", "pnpm"], p), 0, p.err());
  const pkg = JSON.parse(readFileSync(join(scratch, "cli-app", "package.json"), "utf8"));
  assert.equal(pkg.name, "cli-app");
  assert.equal(pkg.dependencies["@rivetjs/router"], versionRange(ownVersion()));
  assert.ok(existsSync(join(scratch, "cli-app", "Dockerfile")));
  assert.ok(!existsSync(join(scratch, "cli-app", ".git")));
  assert.match(p.out(), /Created cli-app \(Node server\)/);
  assert.match(p.out(), /cd cli-app\n {2}pnpm install\n {2}pnpm dev/);
  // Not empty now: refused without --force, written with it.
  const again = io();
  assert.equal(await main(["cli-app", "--yes", "--no-install", "--no-git"], again), 1);
  assert.match(again.err(), /not empty/);
  assert.equal(await main(["cli-app", "--yes", "--no-install", "--no-git", "--force", "--name", "renamed"], io()), 0);
  assert.equal(JSON.parse(readFileSync(join(scratch, "cli-app", "package.json"), "utf8")).name, "renamed");
});

test("cli without a TTY and without --yes takes the defaults (static template, folder rivet-app)", async () => {
  const p = io();
  p.cwd = join(scratch, "defaults");
  mkdirSync(p.cwd);
  assert.equal(await main(["--no-install", "--no-git"], p), 0, p.err());
  assert.ok(existsSync(join(p.cwd, "rivet-app", "src/components/Counter.tsx")));
  assert.equal(isEmptyDir(join(p.cwd, "rivet-app")), false);
});

test("cli interactive (TTY input, numbered fallback when raw mode is unavailable): asks name, template, install, git", async () => {
  const p = io(["asked-app", "4", "", "n", "n"], true);
  assert.equal(await main([], p), 0, p.err());
  const out = p.out();
  assert.match(out, /Project name:/);
  assert.match(out, /Template:/);
  assert.match(out, /Deploy target:\n {2}1\. None - static files/);
  assert.doesNotMatch(out, /Bun/, "bun / deno are offered for the server template only");
  assert.match(out, /Install dependencies with npm\?/);
  assert.match(out, /Initialise a git repository\?/);
  assert.ok(existsSync(join(scratch, "asked-app", "src/routes/index.tsx")));
  assert.equal(JSON.parse(readFileSync(join(scratch, "asked-app", "package.json"), "utf8")).name, "asked-app");
  assert.ok(!existsSync(join(scratch, "asked-app", "src/components")), "minimal template (choice 4)");
});

test("cli git: init + first commit in a new folder", async () => {
  const p = io();
  const saved = { ...process.env };
  Object.assign(process.env, {
    GIT_AUTHOR_NAME: "t",
    GIT_AUTHOR_EMAIL: "t@example.com",
    GIT_COMMITTER_NAME: "t",
    GIT_COMMITTER_EMAIL: "t@example.com",
    GIT_CONFIG_NOSYSTEM: "1",
  });
  try {
    assert.equal(await main([join(scratch, "git-app"), "--template", "minimal", "--yes", "--no-install"], p), 0, p.err());
  } finally {
    process.env = saved;
  }
  assert.ok(existsSync(join(scratch, "git-app", ".git")));
  assert.match(p.out(), /Git repository created/);
});

test("deploy: adapter inserted into rivetRouter({ … }) / rivetRouter(); missing call or a second adapter throws", () => {
  assert.equal(addAdapter(`rivetRouter({ mode: "static" })`, "vercel"), `rivetRouter({ adapter: "vercel", mode: "static" })`);
  assert.equal(addAdapter(`rivetRouter()`, "bun"), `rivetRouter({ adapter: "bun" })`);
  assert.equal(addAdapter(`rivetRouter({\n    styles: ["a"] })`, "deno"), `rivetRouter({ adapter: "deno", styles: ["a"] })`);
  assert.throws(() => addAdapter(`defineConfig({})`, "vercel"), /no rivetRouter/);
  assert.throws(() => addAdapter(`rivetRouter({ adapter: "fetch" })`, "vercel"), /already sets an adapter/);
  assert.match(deployProblem("bun", "static") ?? "", /--template server/);
  assert.equal(deployProblem("bun", "server"), undefined);
  assert.equal(deployProblem("cloudflare", "ui"), undefined);
});

/** Scaffold layout per deploy target over the server starter (files only; the build is covered by create-e2e). */
const LAYOUT: Record<string, { files: string[]; gone: string[]; scripts: Record<string, string>; dev?: Record<string, string> }> = {
  vercel: { files: ["serve.js", "Dockerfile"], gone: ["netlify.toml"], scripts: { start: "node serve.js", deploy: "vercel deploy --prebuilt" } },
  netlify: { files: ["netlify.toml", "serve.js"], gone: [], scripts: { start: "node serve.js" } },
  cloudflare: {
    files: ["serve.js"],
    gone: ["netlify.toml"],
    scripts: { preview: "wrangler dev", deploy: "wrangler deploy" },
    dev: { wrangler: WRANGLER_RANGE },
  },
  bun: { files: [], gone: ["serve.js", "Dockerfile", ".dockerignore"], scripts: { start: "bun dist/server/bun.js" } },
  deno: {
    files: [],
    gone: ["serve.js", "Dockerfile", ".dockerignore"],
    scripts: { start: "deno run --allow-net --allow-read --allow-env dist/server/deno.js" },
  },
};

for (const { id, label } of DEPLOY_TARGETS) {
  test(`cli --deploy ${id}: scaffold layout (vite.config adapter, .gitignore, platform files, scripts, README)`, async () => {
    const p = io();
    const folder = `deploy-${id}`;
    assert.equal(await main([folder, "--template", "server", "--deploy", id, "--yes", "--no-install", "--no-git", "--pm", "pnpm"], p), 0, p.err());
    const at = (file: string) => join(scratch, folder, file);
    assert.match(p.out(), new RegExp(`\\(Node server, ${label}\\)`));
    assert.match(readFileSync(at("vite.config.ts"), "utf8"), new RegExp(`rivetRouter\\(\\{ adapter: "${id}", styles: \\["src/styles.css"\\] \\}\\)`));
    const ignored = readFileSync(at(".gitignore"), "utf8").split("\n");
    for (const entry of ["node_modules/", "dist/", ".rivet/", ".vercel/", ".netlify/", ".wrangler/"]) assert.ok(ignored.includes(entry), entry);
    const { files, gone, scripts, dev } = LAYOUT[id]!;
    for (const file of files) assert.ok(existsSync(at(file)), `${id}: ${file}`);
    for (const file of gone) assert.ok(!existsSync(at(file)), `${id}: no ${file}`);
    const pkg = JSON.parse(readFileSync(at("package.json"), "utf8"));
    for (const [script, command] of Object.entries(scripts)) assert.equal(pkg.scripts[script], command, `${id} ${script}`);
    assert.equal(pkg.scripts.build, "vite build && vite build --ssr");
    for (const [dep, spec] of Object.entries(dev ?? {})) assert.equal(pkg.devDependencies[dep], spec);
    if (id !== "cloudflare") assert.equal(pkg.devDependencies.wrangler, undefined);
    if (id === "netlify") assert.equal(readFileSync(at("netlify.toml"), "utf8"), `[build]\n  command = "pnpm build"\n  publish = "dist/netlify"\n`);
    assert.match(readFileSync(at("README.md"), "utf8"), new RegExp(`## Deploy: ${label}\\n\\n- \\\`vite.config.ts\\\` sets`));
  });
}

test("cli --deploy errors: unknown target, server-only target on a static template", async () => {
  let p = io();
  assert.equal(await main(["x", "--deploy", "heroku", "--yes"], p), 1);
  assert.match(p.err(), /Unknown deploy target "heroku"/);
  p = io();
  assert.equal(await main(["deno-static", "--template", "static", "--deploy", "deno", "--yes", "--no-install", "--no-git"], p), 1);
  assert.match(p.err(), /--deploy deno runs a server: use --template server/);
  assert.ok(!existsSync(join(scratch, "deno-static")));
});

test("deploy on a static template: adapter + gitignore, preview script kept for vercel", () => {
  const target = join(scratch, "projects", "static-vercel");
  createProject({ dir: target, template: "static", overlays: [deployOverlay("vercel")] });
  assert.match(readFileSync(join(target, "vite.config.ts"), "utf8"), /rivetRouter\(\{ adapter: "vercel", mode: "static", styles/);
  assert.equal(JSON.parse(readFileSync(join(target, "package.json"), "utf8")).scripts.preview, "node serve.js");
});
