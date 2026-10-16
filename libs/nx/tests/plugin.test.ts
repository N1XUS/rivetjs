// Inferred tasks: createNodes over real folders (configs are read as text from disk).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { CreateNodesContext } from "@nx/devkit";
import { afterAll, describe, expect, test } from "vitest";
import { CONFIG_GLOB, createNodes, createNodesV2 } from "../plugin.ts";
import { detectProject, i18nLocales, routerAdapter, routerMode } from "../utils/detect.ts";
import { rivetTargets, targetNames } from "../utils/targets.ts";

const root = mkdtempSync(join(tmpdir(), "rivet-nx-plugin-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

function write(path: string, text: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

const ROUTER_STATIC =
  'import { rivetRouter } from "@rivetjs/router/vite";\nexport default { plugins: [rivetRouter({ mode: "static", styles: ["src/styles.css"] })] };\n';
const ROUTER_NODE = 'import { rivetRouter } from "@rivetjs/router/vite";\nexport default { plugins: [rivetRouter()] };\n';
const VITEST = 'import { rivetTest } from "@rivetjs/testing/vite";\nexport default { plugins: [rivetTest()] };\n';

write("apps/site/package.json", "{}");
write("apps/site/vite.config.ts", ROUTER_STATIC);
write("apps/site/vitest.config.ts", VITEST);
write("apps/site/tsconfig.json", "{}");
write("apps/site/serve.js", "");
write("apps/api/project.json", "{}");
write("apps/api/vite.config.mts", ROUTER_NODE);
write("apps/intl/package.json", "{}");
write("apps/intl/vite.config.ts", 'import { i18n } from "@rivetjs/i18n/vite";\n' + ROUTER_NODE);
write("apps/intl/i18n.config.ts", 'export const config = { locales: ["en", "de"], defaultLocale: "en" };\n');
write("apps/spa/package.json", "{}");
write("apps/spa/vite.config.js", 'import { rivet } from "@rivetjs/compiler/vite";\nexport default { plugins: [rivet()] };\n');
write("libs/kit/package.json", "{}");
write("libs/kit/vitest.config.ts", VITEST);
write("libs/kit/tsconfig.json", "{}");
write("apps/react/package.json", "{}");
write("apps/react/vite.config.ts", 'import react from "@vitejs/plugin-react";\nexport default { plugins: [react()] };\n');
write("loose/vite.config.ts", ROUTER_NODE);

const context = (namedInputs: Record<string, string[]> = {}): CreateNodesContext => ({ workspaceRoot: root, nxJsonConfiguration: { namedInputs } });
const files = [
  "apps/site/vite.config.ts",
  "apps/site/vitest.config.ts",
  "apps/api/vite.config.mts",
  "apps/intl/vite.config.ts",
  "apps/spa/vite.config.js",
  "libs/kit/vitest.config.ts",
  "apps/react/vite.config.ts",
  "loose/vite.config.ts",
];

async function infer(options?: Record<string, string>, ctx = context()) {
  const results = await createNodes[1](files, options, ctx);
  return Object.fromEntries(results.map(([file, result]) => [file, result]));
}

describe("createNodes", () => {
  test("glob and v2 alias", () => {
    expect(createNodes[0]).toBe(CONFIG_GLOB);
    expect(createNodesV2).toBe(createNodes);
  });

  test("static app with tests: every target, prerendering build, cache inputs/outputs", async () => {
    const result = await infer();
    const project = result["apps/site/vite.config.ts"]!.projects!["apps/site"]!;
    expect(project.projectType).toBe("application");
    expect(Object.keys(project.targets!)).toEqual(["build", "dev", "preview", "test", "check", "typecheck"]);
    expect(project.targets).toMatchSnapshot();
    // The sibling vitest config is folded into the vite config's project.
    expect(result["apps/site/vitest.config.ts"]).toEqual({});
  });

  test("node app with project.json, no tsconfig / tests", async () => {
    const project = (await infer())["apps/api/vite.config.mts"]!.projects!["apps/api"]!;
    expect(Object.keys(project.targets!)).toEqual(["build", "dev", "preview"]);
    expect(project.targets!["build"]!.metadata!.description).toBe("Client + server build");
  });

  test("i18n app: one client build per locale", async () => {
    const project = (await infer())["apps/intl/vite.config.ts"]!.projects!["apps/intl"]!;
    expect(project.targets!["build"]!.options).toEqual({ locales: ["en", "de"] });
  });

  test("compiler-only app, library, non-Rivet and loose configs", async () => {
    const result = await infer();
    expect(Object.keys(result["apps/spa/vite.config.js"]!.projects!["apps/spa"]!.targets!)).toEqual(["build", "dev", "preview"]);
    const kit = result["libs/kit/vitest.config.ts"]!.projects!["libs/kit"]!;
    expect(kit.projectType).toBeUndefined();
    expect(Object.keys(kit.targets!)).toEqual(["test", "check", "typecheck"]);
    expect(result["apps/react/vite.config.ts"]).toEqual({});
    expect(result["loose/vite.config.ts"]).toEqual({});
  });

  test("target names from plugin options; production named input", async () => {
    const project = (await infer({ buildTargetName: "bundle", devTargetName: "serve" }, context({ production: ["default"] })))["apps/site/vite.config.ts"]!
      .projects!["apps/site"]!;
    expect(Object.keys(project.targets!)).toEqual(["bundle", "serve", "preview", "test", "check", "typecheck"]);
    expect(project.targets!["preview"]!.dependsOn).toEqual(["bundle"]);
    expect(project.targets!["bundle"]!.inputs!.slice(0, 2)).toEqual(["production", "^production"]);
  });
});

describe("detection", () => {
  const files = { tsconfig: false, serveScript: false, prerenderScript: false };
  test("router mode, locales, kinds", () => {
    expect(routerMode('rivetRouter({ styles: [], mode: "csr" })')).toBe("csr");
    expect(routerMode("rivetRouter()")).toBeUndefined();
    expect(i18nLocales("locales: ['en', \"fr\"]")).toEqual(["en", "fr"]);
    expect(i18nLocales("locales: []")).toBeUndefined();
    expect(detectProject({ vite: 'rivetRouter({ mode: "csr" })', files })).toMatchObject({ kind: "app", csr: true, static: false });
    expect(detectProject({ vite: "export default {}", files })).toBeUndefined();
    // A vite config `test` block with rivetTest() counts as a test setup.
    expect(detectProject({ vite: "rivetRouter(); export default { plugins: [rivetTest()], test: {} }", files })!.test).toBe(true);
  });

  test("platform adapters: detected, create-rivet's commands as deploy / preview targets, packaging outputs", () => {
    expect(routerAdapter('rivetRouter({ adapter: "vercel", mode: "static" })')).toBe("vercel");
    expect(routerAdapter('rivetRouter({ adapter: { name: "cloudflare", wrangler: {} } })')).toBe("cloudflare");
    expect(routerAdapter("rivetRouter()")).toBeUndefined();
    const facts = (adapter: string) => detectProject({ vite: `rivetRouter({ adapter: "${adapter}" })`, files })!;
    const vercel = rivetTargets(facts("vercel"));
    expect(vercel["deploy"]).toMatchObject({
      executor: "nx:run-commands",
      dependsOn: ["build"],
      options: { command: "vercel deploy --prebuilt", cwd: "{projectRoot}" },
    });
    expect(vercel["preview"]!.executor).toBe("@rivetjs/nx:preview");
    expect(vercel["build"]!.outputs).toEqual(["{projectRoot}/dist", "{projectRoot}/.vercel/output"]);
    const cloudflare = rivetTargets(facts("cloudflare"), { deployTargetName: "ship" });
    expect(cloudflare["ship"]!.options).toEqual({ command: "wrangler deploy", cwd: "{projectRoot}" });
    expect(cloudflare["preview"]).toMatchObject({ executor: "nx:run-commands", continuous: true, options: { command: "wrangler dev" } });
    expect(rivetTargets(facts("bun"))["preview"]!.options).toEqual({ command: "bun dist/server/bun.js", cwd: "{projectRoot}" });
    expect(rivetTargets(facts("bun"))["deploy"]).toBeUndefined();
    expect(rivetTargets(facts("netlify"))["build"]!.outputs).toEqual(["{projectRoot}/dist", "{projectRoot}/.netlify/v1"]);
    expect(rivetTargets(facts("vercel"))["build"]!.inputs).toContain("!{projectRoot}/.vercel/**/*");
  });

  test("csr apps build without a server; names fall back to defaults", () => {
    const targets = rivetTargets({ kind: "app", static: false, csr: true, test: false, tsconfig: false, serveScript: false, prerenderScript: false });
    expect(targets["build"]!.metadata!.description).toBe("Browser build (csr mode)");
    expect(targetNames({ buildTargetName: "" }).buildTargetName).toBe("build");
  });
});
