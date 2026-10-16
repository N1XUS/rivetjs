// scripts/release: version arithmetic, manifest bumps, publishable libs, conventional-commit changelog, --publish guard.
import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, test } from "vitest";
import { commitsSince, lastTag, parseCommit, renderChangelog } from "../release/changelog.ts";
import { bumpManifest, bumpWorkspace, currentVersion, nextVersion, ORDER, publishableLibs, ROOT } from "../release/version.ts";
import { assertLocalRegistry, assertNpmTargets, localNpmArgs, localNpmEnv, stripRegistryKeys } from "../release/verdaccio.ts";
import { dryRunArgs, publishArgs } from "../release/release.ts";
import { PACKAGES } from "../package/smoke.ts";

const scratch = mkdtempSync(join(tmpdir(), "release-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

test("nextVersion: placeholder counts as unreleased, semver bumps, prerelease ids, explicit versions", () => {
  assert.equal(nextVersion("0.0.0-experimental", "minor"), "0.1.0");
  assert.equal(nextVersion("0.0.0-experimental", "patch"), "0.0.1");
  assert.equal(nextVersion("0.0.0-experimental", "major"), "1.0.0");
  assert.equal(nextVersion("0.0.0-experimental", "prerelease"), "0.1.0-alpha.0");
  assert.equal(nextVersion("0.1.0-alpha.0", "prerelease"), "0.1.0-alpha.1");
  assert.equal(nextVersion("0.1.0-alpha.3", "prerelease", "beta"), "0.1.0-beta.0");
  assert.equal(nextVersion("0.1.0-alpha.3", "minor"), "0.1.0");
  assert.equal(nextVersion("0.1.0", "prerelease"), "0.1.1-alpha.0");
  assert.equal(nextVersion("0.1.2", "minor"), "0.2.0");
  assert.equal(nextVersion("0.1.2", "patch"), "0.1.3");
  assert.equal(nextVersion("1.4.2", "major"), "2.0.0");
  assert.equal(nextVersion("0.1.0", "0.3.0-rc.1"), "0.3.0-rc.1");
  assert.throws(() => nextVersion("0.1.0", "huge"), /unknown bump/);
});

test("bumpManifest: version + internal specs in every dependency field; third-party specs kept", () => {
  const names = new Set(["@rivetjs/runtime", "@rivetjs/reactivity", "create-rivet"]);
  assert.deepEqual(
    bumpManifest(
      {
        name: "@rivetjs/x",
        version: "0.0.0-experimental",
        dependencies: { "@rivetjs/runtime": "0.0.0-experimental", svgo: "4.1.0" },
        peerDependencies: { "@rivetjs/reactivity": "0.0.0-experimental", vite: "^8.3.2" },
        devDependencies: { "create-rivet": "0.0.0-experimental" },
      },
      "0.2.0",
      names,
    ),
    {
      name: "@rivetjs/x",
      version: "0.2.0",
      dependencies: { "@rivetjs/runtime": "0.2.0", svgo: "4.1.0" },
      peerDependencies: { "@rivetjs/reactivity": "0.2.0", vite: "^8.3.2" },
      devDependencies: { "create-rivet": "0.2.0" },
    },
  );
});

test("publishableLibs: every lib with publishConfig.directory, dependency order, one shared version; docs-kit excluded", () => {
  const libs = publishableLibs();
  const dirs = libs.map((lib) => lib.dir);
  assert.ok(dirs.includes("create-rivet") && dirs.includes("ui") && dirs.includes("reactivity"));
  assert.ok(!dirs.includes("docs-kit"));
  assert.deepEqual(
    dirs,
    ORDER.filter((dir) => dirs.includes(dir)),
  );
  assert.ok(dirs.indexOf("reactivity") < dirs.indexOf("runtime") && dirs.indexOf("cdk") < dirs.indexOf("ui"));
  assert.equal(currentVersion(libs), libs[0]!.version);
  assert.throws(() => currentVersion([libs[0]!, { ...libs[1]!, version: "9.9.9" }]), /disagree/);
  for (const lib of libs) assert.ok(lib.dist.endsWith(join("dist", "libs", lib.dir)), lib.dist);
});

test("tarball smoke covers every package in the release", () => {
  assert.deepEqual(
    PACKAGES,
    publishableLibs().map((lib) => lib.dir),
  );
});

test("release bump keeps private workspace dependencies and lock entries aligned with the published packages", () => {
  const root = join(scratch, "workspace");
  const files = {
    "package.json": { name: "workspace", version: "0.1.0", workspaces: ["libs/*", "apps/*"] },
    "libs/core/package.json": { name: "@rivetjs/core", version: "0.0.0-experimental", publishConfig: { directory: "../../dist/libs/core" } },
    "libs/docs-kit/package.json": {
      name: "@rivetjs/docs-kit",
      version: "0.0.0-experimental",
      private: true,
      peerDependencies: { "@rivetjs/core": "0.0.0-experimental" },
    },
    "apps/docs/package.json": {
      name: "docs",
      version: "0.0.0-experimental",
      private: true,
      dependencies: { "@rivetjs/core": "0.0.0-experimental", vite: "^8.3.2" },
    },
  };
  for (const [name, value] of Object.entries(files)) {
    const target = join(root, name);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, JSON.stringify(value));
  }
  const packages: Record<string, unknown> = Object.fromEntries(Object.entries(files).map(([name, value]) => [name.replace(/\/?package.json$/, ""), value]));
  packages["node_modules/@rivetjs/core"] = { resolved: "libs/core", link: true };
  writeFileSync(join(root, "package-lock.json"), JSON.stringify({ name: "workspace", lockfileVersion: 3, packages }));
  bumpWorkspace(root, "0.1.0-alpha.0");
  const read = (file: string) => JSON.parse(readFileSync(join(root, file), "utf8"));
  assert.equal(read("libs/core/package.json").version, "0.1.0-alpha.0");
  assert.equal(read("apps/docs/package.json").version, "0.0.0-experimental", "private app versions do not change");
  assert.equal(read("apps/docs/package.json").dependencies["@rivetjs/core"], "0.1.0-alpha.0");
  assert.equal(read("libs/docs-kit/package.json").peerDependencies["@rivetjs/core"], "0.1.0-alpha.0");
  assert.equal(read("apps/docs/package.json").dependencies.vite, "^8.3.2");
  const lock = read("package-lock.json");
  assert.equal(lock.packages["libs/core"].version, "0.1.0-alpha.0");
  assert.deepEqual(lock.packages["apps/docs"].dependencies, read("apps/docs/package.json").dependencies);
  assert.deepEqual(lock.packages["node_modules/@rivetjs/core"], { resolved: "libs/core", link: true });
});

test("publish arguments retain provenance by default and support private-repository releases without it", () => {
  const common = ["publish", "/dist/core", "--tag", "latest", "--access", "public"];
  assert.deepEqual(publishArgs("/dist/core", "latest", { publish: true, provenance: true }), [...common, "--provenance"]);
  assert.deepEqual(publishArgs("/dist/core", "latest", { publish: true, provenance: false }), common);
  assert.deepEqual(publishArgs("/dist/core", "latest", {}), [...common, "--dry-run"]);
});

test("changelog: conventional subjects, scopes, breaking (! and footer), sections, counts", () => {
  assert.deepEqual(parseCommit("a".repeat(40), "feat(ui): ScrollShadow"), {
    hash: "a".repeat(40),
    type: "feat",
    scope: "ui",
    breaking: false,
    subject: "ScrollShadow",
  });
  assert.equal(parseCommit("b", "Merge branch x"), undefined);
  assert.equal(parseCommit("c", "refactor!: drop v1")?.breaking, true);
  const footer = parseCommit("d", "fix(router): links", "Body.\n\nBREAKING CHANGE: `href` must be absolute\n");
  assert.equal(footer?.breaking, true);
  assert.equal(footer?.note, "`href` must be absolute");
  const md = renderChangelog(
    "0.1.0",
    [
      parseCommit("1111111111", "feat(ui): Card")!,
      parseCommit("2222222222", "fix: escape")!,
      parseCommit("3333333333", "perf(runtime): slabs")!,
      parseCommit("4444444444", "docs: guide")!,
      parseCommit("5555555555", "feat(compiler)!: v2 only")!,
    ],
    { date: "2026-10-08", skipped: 2 },
  );
  assert.equal(
    md,
    [
      "## 0.1.0 (2026-10-08)",
      "",
      "### Breaking changes",
      "",
      "- **compiler:** v2 only (55555555)",
      "",
      "### Features",
      "",
      "- **ui:** Card (11111111)",
      "- **compiler:** v2 only (55555555)",
      "",
      "### Fixes",
      "",
      "- escape (22222222)",
      "",
      "### Performance",
      "",
      "- **runtime:** slabs (33333333)",
      "",
      "Not listed: 1 docs, 2 non-conventional.",
      "",
    ].join("\n"),
  );
});

test("changelog: commits since the last v* tag in a git repository", () => {
  const repo = join(scratch, "repo");
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" },
    });
  execFileSync("git", ["init", "-q", repo]);
  const commit = (subject: string) => {
    writeFileSync(join(repo, "f"), subject);
    git("add", "f");
    git("commit", "-q", "-m", subject);
  };
  commit("feat: first");
  assert.equal(lastTag(repo), undefined);
  assert.deepEqual(
    commitsSince(undefined, repo).commits.map((c) => c.subject),
    ["first"],
  );
  git("tag", "v0.1.0");
  commit("fix(x): second");
  commit("not conventional");
  assert.equal(lastTag(repo), "v0.1.0");
  const { commits, skipped } = commitsSince("v0.1.0", repo);
  assert.deepEqual(
    commits.map((c) => `${c.type}:${c.scope}:${c.subject}`),
    ["fix:x:second"],
  );
  assert.equal(skipped, 1);
});

test("release.ts --publish refuses to run outside GitHub Actions", () => {
  const env = { ...process.env, GITHUB_ACTIONS: "", NODE_AUTH_TOKEN: "" };
  const run = spawnSync(process.execPath, [join(ROOT, "scripts/release/release.ts"), "minor", "--apply", "--publish"], { cwd: ROOT, encoding: "utf8", env });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--publish runs only in \.github\/workflows\/release\.yml/);
});

test("release.ts --registry: non-local registries and --apply refused", () => {
  const release = (...args: string[]) =>
    spawnSync(process.execPath, [join(ROOT, "scripts/release/release.ts"), "minor", ...args], { cwd: ROOT, encoding: "utf8" });
  for (const url of ["https://registry.npmjs.org/", "http://127.0.0.1.evil.com/", "http://localhost@registry.npmjs.org/"]) {
    const run = release("--registry", url);
    assert.equal(run.status, 1, url);
    assert.match(run.stderr, /refusing to publish/, url);
  }
  assert.match(release("--registry", "http://127.0.0.1:4873/", "--apply").stderr, /--registry \(local publish\) and --apply exclude each other/);
  assert.match(release("--registry", "http://127.0.0.1:4873/", "--publish", "--apply").stderr, /exclude each other/);
  assert.throws(() => assertLocalRegistry("file:///tmp/registry"), /refusing/);
});

test("local publish: a scoped @rivetjs registry (npmrc or publishConfig) cannot redirect to npmjs (no network)", () => {
  const local = "http://127.0.0.1:4873/";
  const dir = join(scratch, "scoped");
  mkdirSync(join(dir, "pkg"), { recursive: true });
  // HOME in scratch: the user's ~/.npmrc is never read by this test.
  const base = { PATH: process.env["PATH"] ?? "", HOME: dir };
  const scoped = join(dir, "scoped.npmrc");
  writeFileSync(scoped, `@rivetjs:registry=https://registry.npmjs.org/\ncache=${join(dir, "cache")}\n`);
  const env = localNpmEnv(scoped, base);
  // Without the scope flag npm would publish @rivetjs/* to npmjs: refused.
  assert.throws(
    () => assertNpmTargets(local, ["--userconfig", scoped, "--registry", local], env, scoped),
    /@rivetjs:registry to https:\/\/registry\.npmjs\.org/,
  );
  // localNpmArgs pins the scope too: accepted.
  assertNpmTargets(local, localNpmArgs(local, scoped), env, scoped);
  // Credentials for npmjs in the userconfig: refused.
  const token = join(dir, "token.npmrc");
  writeFileSync(token, `//registry.npmjs.org/:_authToken=not-a-token\ncache=${join(dir, "cache")}\n`);
  assert.throws(() => assertNpmTargets(local, localNpmArgs(local, token), localNpmEnv(token, base), token), /credentials for registry\.npmjs\.org/);
  // A different user config than the one required: refused.
  assert.throws(() => assertNpmTargets(local, localNpmArgs(local, scoped), env, token), /reads the user config/);

  // Manifest publishConfig["@rivetjs:registry"]: dropped by stripRegistryKeys, and the CLI scope flag wins anyway.
  const manifest = {
    name: "@rivetjs/probe",
    version: "1.0.0",
    publishConfig: { access: "public", registry: "https://registry.npmjs.org/", "@rivetjs:registry": "https://registry.npmjs.org/" },
  };
  writeFileSync(join(dir, "pkg/package.json"), JSON.stringify(manifest));
  const dryRun = spawnSync("npm", ["publish", join(dir, "pkg"), "--dry-run", "--offline", ...localNpmArgs(local, scoped)], { cwd: dir, env, encoding: "utf8" });
  assert.match(dryRun.stdout + dryRun.stderr, /Publishing to http:\/\/127\.0\.0\.1:4873\//);
  assert.deepEqual(stripRegistryKeys(manifest), ["registry", "@rivetjs:registry"]);
  assert.deepEqual(manifest.publishConfig, { access: "public" });
});

test("local publish: the dry-run probe is offline and names the (fake loopback) registry", () => {
  const local = "http://127.0.0.1:9/"; // discard port: nothing listens, nothing may be requested
  const dir = join(scratch, "probe");
  mkdirSync(join(dir, "pkg"), { recursive: true });
  const npmrc = join(dir, "npmrc");
  writeFileSync(npmrc, `cache=${join(dir, "cache")}\n`);
  writeFileSync(join(dir, "pkg/package.json"), JSON.stringify({ name: "@rivetjs/probe", version: "1.0.0" }));
  const args = dryRunArgs(join(dir, "pkg"), "latest", localNpmArgs(local, npmrc));
  assert.deepEqual(args.slice(-2), ["--dry-run", "--offline"]);
  const run = spawnSync("npm", args, { cwd: dir, env: localNpmEnv(npmrc, { PATH: process.env["PATH"] ?? "", HOME: dir }), encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout + run.stderr, /Publishing to http:\/\/127\.0\.0\.1:9\/ .*\(dry-run\)/);
});

test("local publish: project .npmrc, global npmrc and proxy env refused; proxies dropped, --noproxy passed (no network)", () => {
  const local = "http://127.0.0.1:9/";
  const dir = join(scratch, "layers");
  mkdirSync(dir, { recursive: true });
  const npmrc = join(dir, "npmrc");
  writeFileSync(npmrc, `cache=${join(dir, "cache")}\n`);
  const base = { PATH: process.env["PATH"] ?? "", HOME: dir };
  const args = localNpmArgs(local, npmrc);
  assert.ok(args.includes("--noproxy=localhost,127.0.0.1,::1"));
  const env = localNpmEnv(npmrc, { ...base, HTTPS_PROXY: "http://proxy.example:8080", http_proxy: "http://proxy.example:8080", npm_config_proxy: "x" });
  for (const key of ["HTTPS_PROXY", "http_proxy", "npm_config_proxy"]) assert.equal(env[key], undefined, key);
  assertNpmTargets(local, args, env, npmrc, dir);
  assert.throws(() => assertNpmTargets(local, args, { ...env, HTTPS_PROXY: "http://proxy.example:8080" }, npmrc, dir), /proxy setting HTTPS_PROXY/);
  const global = join(dir, "global.npmrc");
  writeFileSync(global, "");
  assert.throws(() => assertNpmTargets(local, args, { ...env, NPM_CONFIG_GLOBALCONFIG: global }, npmrc, dir), /global npm config .* exists/);
  writeFileSync(join(dir, ".npmrc"), "@rivetjs:registry=https://registry.npmjs.org/\n");
  assert.throws(() => assertNpmTargets(local, args, env, npmrc, dir), /\.npmrc exists \(project npm config\)/);
});
