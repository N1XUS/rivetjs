// Release flow for every publishable lib (one version). DRY RUN by default: nothing is written to the source tree,
// nothing is tagged, nothing leaves the machine except `npm publish --dry-run` (which uploads nothing).
//
//   node scripts/release/release.ts <major|minor|patch|prerelease|x.y.z[-pre]> [--preid alpha] [--tag <dist-tag>]
//        [--apply] [--skip-package] [--skip-smoke] [--skip-e2e] [--publish | --registry <local url>]
//
//   1. version: current (all libs agree) → next
//   2. changelog: conventional commits since the last `v*` tag (printed; `--apply` prepends it to CHANGELOG.md)
//   3. bump: `--apply` rewrites published versions, all workspace internal specs, and matching lock entries;
//      otherwise only the built dist manifests get the next version (step 5)
//   4. `nx run-many -t package` → dist/libs/<lib>
//   5. dist manifests → next version (dry run)
//   6. `node scripts/package/smoke.ts --no-build` (tarballs installed offline, imports, tsc, starter builds)
//   7. `node scripts/package/create-e2e.ts` (create-rivet → install → build → serve, every template)
//   8. `npm publish <dist> --dry-run --tag <tag>` per lib, in dependency order
//   9. prints the tag it would create (`v<next>`); never tags.
//
// `--registry <url>` (local end to end, `scripts/release/local-e2e.ts`): step 8 publishes for real, but only to a
// registry on this machine (localhost / 127.0.0.1 / [::1]; anything else is refused) — no provenance, source untouched
// (`--apply` refused). Enforced: storage/npmrc must exist (`verdaccio.ts start` / `userconfig()`) and is the user config
// of every npm call (`--userconfig` + `NPM_CONFIG_USERCONFIG`; inherited `npm_config_*` and proxy env dropped,
// `--noproxy` for loopback, global config pointed into storage); `--@rivetjs:registry=<url>` (a scoped registry would
// beat `--registry`); dist `publishConfig` registry keys dropped. Refused: a repo-root `.npmrc`, an existing global
// npmrc, `npm config get registry` / `@rivetjs:registry` not the local URL, another user config, non-local
// credentials, and a package whose `npm publish --dry-run --offline` does not name the local registry.
//
// `--publish` is for .github/workflows/release.yml only: real `npm publish` per lib (provenance unless disabled
// for a private repository with NPM_CONFIG_PROVENANCE=false). It refuses to run
// outside GitHub Actions (`GITHUB_ACTIONS=true`) or without `NODE_AUTH_TOKEN`. The workflow commits + tags itself.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { commitsSince, lastTag, renderChangelog } from "./changelog.ts";
import { bumpFile, bumpWorkspace, currentVersion, nextVersion, publishableLibs, ROOT, type Lib } from "./version.ts";
import { assertLocalRegistry, assertNpmTargets, localNpmArgs, localNpmEnv, stripRegistryKeys, USERCONFIG } from "./verdaccio.ts";

const step = (title: string) => console.log(`\n== ${title}`);

/** Recovery skips only packages whose exact tarball is already published. */
export function resumeIndex(libs: Lib[], from: string | undefined): number {
  if (!from) return 0;
  const index = libs.findIndex((lib) => lib.dir === from);
  if (index < 0) throw new Error(`unknown recovery package: ${from}`);
  return index;
}

export function assertPublishedIntegrity(name: string, local: string, remote: unknown): void {
  if (!local || local !== remote) throw new Error(`${name}: published contents differ; refusing to skip this package`);
}

/** The local path's pre-publish probe: same flags as the real publish, `--dry-run --offline` (no request to any host). */
export function dryRunArgs(dist: string, tag: string, npmArgs: string[]): string[] {
  return ["publish", dist, "--tag", tag, "--access", "public", ...npmArgs, "--dry-run", "--offline"];
}

/** Private repositories cannot generate npm provenance; public CI releases retain it by default. */
export function publishArgs(
  dist: string,
  tag: string,
  { publish = false, localArgs = [] as string[], provenance = process.env["NPM_CONFIG_PROVENANCE"] !== "false" } = {},
): string[] {
  return [
    "publish",
    dist,
    "--tag",
    tag,
    "--access",
    "public",
    ...(publish ? (provenance ? ["--provenance"] : []) : localArgs.length ? localArgs : ["--dry-run"]),
  ];
}

function sh(command: string, args: string[], { env = {}, capture = false, stdoutOnly = false } = {}): string {
  console.log(`$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
    env: { ...process.env, NX_DAEMON: "false", NX_ISOLATE_PLUGINS: "false", ...env },
    maxBuffer: 64 << 20,
  });
  if (result.status !== 0) {
    if (capture) console.error((result.stderr || result.stdout).trim());
    throw new Error(`${command} ${args.join(" ")} exited ${result.status}`);
  }
  return capture ? (stdoutOnly ? result.stdout : result.stdout + result.stderr) : "";
}

export function main(argv: string[]): void {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      preid: { type: "string", default: "alpha" },
      tag: { type: "string" },
      apply: { type: "boolean", default: false },
      publish: { type: "boolean", default: false },
      registry: { type: "string" },
      "resume-from": { type: "string" },
      "skip-package": { type: "boolean", default: false },
      "skip-smoke": { type: "boolean", default: false },
      "skip-e2e": { type: "boolean", default: false },
    },
  });
  const bump = positionals[0];
  if (!bump || positionals.length > 1) throw new Error("usage: node scripts/release/release.ts <major|minor|patch|prerelease|x.y.z> [--apply] [--tag t] …");
  if (values.publish && !values.apply) throw new Error("--publish needs --apply (the published version must be the committed one)");
  if (values["resume-from"] && !values.publish) throw new Error("--resume-from requires --publish (CI recovery only)");
  if (values.registry && values.publish) throw new Error("--registry (local publish) and --publish (npmjs, CI only) exclude each other");
  if (values.registry && values.apply)
    throw new Error("--registry (local publish) and --apply exclude each other: a local publish never writes the source tree");
  const local = values.registry ? assertLocalRegistry(values.registry).href : undefined;
  // Local path: every npm call (incl. `npx nx`) reads only the project userconfig; checked before anything runs.
  const npmArgs = local ? localNpmArgs(local) : [];
  if (local) {
    if (!existsSync(USERCONFIG)) throw new Error(`--registry needs ${USERCONFIG} (node scripts/release/verdaccio.ts start writes it)`);
    const env = localNpmEnv();
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
    assertNpmTargets(local, npmArgs, process.env);
  }
  if (values.publish && (process.env["GITHUB_ACTIONS"] !== "true" || !process.env["NODE_AUTH_TOKEN"]))
    throw new Error("--publish runs only in .github/workflows/release.yml (GITHUB_ACTIONS=true + NODE_AUTH_TOKEN)");

  step("1. version");
  const libs = publishableLibs();
  const resume = resumeIndex(libs, values["resume-from"]);
  const current = currentVersion(libs);
  const next = nextVersion(current, bump, values.preid);
  const tag = values.tag ?? (next.includes("-") ? "next" : "latest");
  console.log(`${libs.length} packages: ${current} → ${next} (dist-tag ${tag})`);
  console.log(libs.map((lib) => `  ${lib.name}`).join("\n"));
  const names = new Set(libs.map((lib) => lib.name));
  // The workflow's commit / tag steps read it.
  if (process.env["GITHUB_OUTPUT"]) appendFileSync(process.env["GITHUB_OUTPUT"], `version=${next}\ntag=${tag}\n`);

  step("2. changelog");
  const since = lastTag();
  const { commits, skipped } = commitsSince(since);
  const changelog = renderChangelog(next, commits, { skipped });
  console.log(`since ${since ?? "the first commit (no v* tag yet)"}: ${commits.length} conventional commits\n`);
  console.log(changelog);
  if (values.apply) {
    const file = join(ROOT, "CHANGELOG.md");
    const previous = existsSync(file) ? readFileSync(file, "utf8").replace(/^# Changelog\n+/, "") : "";
    writeFileSync(file, `# Changelog\n\n${changelog}\n${previous}`);
    console.log("wrote CHANGELOG.md");
  }

  step("3. bump");
  if (values.apply) {
    bumpWorkspace(ROOT, next);
    console.log(`published libs → ${next}; workspace dependencies + package-lock.json aligned`);
  } else console.log("dry run: source manifests untouched (dist manifests bumped after packaging)");

  step("4. package");
  if (!values["skip-package"]) sh("npx", ["nx", "run-many", "-t", "package", "--output-style=static", "--skip-nx-cache"]);
  for (const lib of libs) if (!existsSync(join(lib.dist, "package.json"))) throw new Error(`${lib.name}: ${lib.dist} not built`);

  step("5. dist manifests");
  for (const lib of libs) bumpFile(join(lib.dist, "package.json"), next, names);
  console.log(`dist/libs/*/package.json → ${next}`);

  step("6. tarball smoke");
  if (!values["skip-smoke"]) sh(process.execPath, ["scripts/package/smoke.ts", "--no-build"]);

  step("7. create-rivet e2e");
  if (!values["skip-e2e"]) sh(process.execPath, ["scripts/package/create-e2e.ts"]);

  step(values.publish ? "8. npm publish" : local ? `8. npm publish --registry ${local} (local)` : "8. npm publish --dry-run");
  // Provenance links each package to this repository: the manifest must name it.
  for (const lib of libs)
    if (!(JSON.parse(readFileSync(join(lib.dist, "package.json"), "utf8")) as { repository?: unknown }).repository)
      throw new Error(`${lib.name}: no "repository" in the dist manifest (root package.json "repository")`);
  if (local) {
    for (const lib of libs) {
      const file = join(lib.dist, "package.json");
      const manifest = JSON.parse(readFileSync(file, "utf8")) as { publishConfig?: Record<string, unknown> };
      const dropped = stripRegistryKeys(manifest);
      if (dropped.length) {
        writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");
        console.log(`  ${lib.name}: dropped publishConfig ${dropped.join(", ")} (local publish)`);
      }
    }
    assertNpmTargets(local, npmArgs, process.env);
  }
  // Check every skipped package before uploading any new package. Registry errors, pending scans,
  // and different tarballs all stop recovery rather than silently accepting an inconsistent release.
  for (const lib of libs.slice(0, resume)) {
    const packed = JSON.parse(sh("npm", ["pack", lib.dist, "--dry-run", "--json"], { capture: true, stdoutOnly: true }));
    const published = JSON.parse(
      sh("npm", ["view", `${lib.name}@${next}`, "dist.integrity", "--json", "--registry", "https://registry.npmjs.org/"], { capture: true, stdoutOnly: true }),
    );
    assertPublishedIntegrity(lib.name, packed[0]?.integrity, published);
    console.log(`  verified existing ${lib.name}@${next}: identical tarball`);
  }
  for (const lib of libs.slice(resume)) {
    if (local) {
      // The exact command, as a dry run first: npm must name the local registry (manifest + every config layer applied).
      const probe = sh("npm", dryRunArgs(lib.dist, tag, npmArgs), { capture: true });
      const target = /Publishing to (\S+)/.exec(probe)?.[1];
      if (!target || assertLocalRegistry(target).href !== local) throw new Error(`refusing to publish ${lib.name}: npm would publish to ${target ?? "?"}`);
    }
    const args = publishArgs(lib.dist, tag, { publish: values.publish, localArgs: local ? npmArgs : [] });
    const out = sh("npm", args, { capture: true });
    const summary = out.split("\n").filter((line) => /(name|version|package size|unpacked size|total files):/.test(line));
    console.log(summary.map((line) => "  " + line.replace(/^npm (notice|warn) /, "").trim()).join("\n"));
  }

  step("9. tag");
  if (values.publish) console.log(`published ${next}; the workflow commits and tags v${next}`);
  else if (local) console.log(`published ${next} to ${local} (local registry); no tag`);
  else console.log(`would create: git tag -a v${next} -m "v${next}" (not created: dry run)`);
}

if (import.meta.main) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`release: ${(error as Error).message}`);
    process.exit(1);
  }
}
