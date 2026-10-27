// Executor option normalisation: the steps (child processes) each executor runs, with a fake bin resolver.
import { describe, expect, test } from "vitest";
import { buildSteps, prerenderCode } from "../executors/build/executor.ts";
import { checkSteps } from "../executors/check/executor.ts";
import { baseUrl, devStep } from "../executors/dev/executor.ts";
import { distManifest, emitStep, mapPath, normalizePackageOptions } from "../executors/package/executor.ts";
import { prerenderStep } from "../executors/prerender/executor.ts";
import { previewStep, startCode } from "../executors/preview/executor.ts";
import { flags, packageDir } from "../executors/run.ts";
import { testStep } from "../executors/test/executor.ts";
import { typecheckSteps } from "../executors/typecheck/executor.ts";
import type { ProjectFacts } from "../utils/detect.ts";

const bin = (pkg: string, name?: string) => `/bin/${pkg}${name ? ":" + name : ""}`;
const root = "/ws/apps/web";
const facts = (extra: Partial<ProjectFacts> = {}): ProjectFacts => ({
  kind: "app",
  static: false,
  csr: false,
  test: true,
  tsconfig: true,
  serveScript: false,
  prerenderScript: false,
  ...extra,
});
const commands = (steps: { args: string[]; env?: Record<string, string> }[]) =>
  steps.map((step) => [...step.args, ...Object.entries(step.env ?? {}).map(([k, v]) => `${k}=${v}`)].join(" "));

describe("build", () => {
  test("node app: client + server", () => {
    expect(commands(buildSteps({}, root, facts(), bin))).toEqual(["/bin/vite build", "/bin/vite build --ssr"]);
  });

  test("static app: prerender via the project's prerender.js, else prerenderBuild", () => {
    expect(commands(buildSteps({}, root, facts({ static: true, prerenderScript: true }), bin)).at(-1)).toBe("/ws/apps/web/prerender.js");
    const steps = buildSteps({ outputPath: "out" }, root, facts({ static: true, prerenderScript: true }), bin);
    expect(steps.at(-1)!.args.slice(0, 2)).toEqual(["--input-type=module", "-e"]);
    expect(steps.at(-1)!.args[2]).toBe(prerenderCode("out"));
    expect(prerenderCode("dist")).toContain('prerenderBuild({ dist: "dist" })');
  });

  test("flags, env, locales, csr, explicit ssr / prerender", () => {
    const steps = buildSteps({ mode: "staging", config: "vite.prod.ts", logLevel: "warn", env: { A: "1" }, locales: ["en", "de"] }, root, facts(), bin);
    expect(commands(steps)).toEqual([
      "/bin/vite build --config vite.prod.ts --mode staging --logLevel warn A=1 RIVET_LOCALE=en",
      "/bin/vite build --config vite.prod.ts --mode staging --logLevel warn A=1 RIVET_LOCALE=de",
      "/bin/vite build --ssr --config vite.prod.ts --mode staging --logLevel warn A=1",
    ]);
    expect(commands(buildSteps({}, root, facts({ csr: true }), bin))).toEqual(["/bin/vite build"]);
    expect(commands(buildSteps({}, root, facts({ kind: "spa" }), bin))).toEqual(["/bin/vite build"]);
    expect(commands(buildSteps({ prerender: false }, root, facts({ static: true }), bin))).toHaveLength(2);
    expect(() => buildSteps({ ssr: false, prerender: true }, root, facts(), bin)).toThrow(/needs the server build/);
    // Inferred locales come from the facts.
    expect(buildSteps({}, root, facts({ locales: ["fr"] }), bin)[0]!.env).toEqual({ RIVET_LOCALE: "fr" });
  });
});

describe("dev / preview / prerender", () => {
  test("dev flags + base URL", () => {
    expect(devStep({ port: 4510, host: true, strictPort: true, open: false }, root, bin).args).toEqual([
      "/bin/vite",
      "--port",
      "4510",
      "--host",
      "--strictPort",
    ]);
    expect(baseUrl({ port: 4510, host: "0.0.0.0" }, 5173)).toBe("http://0.0.0.0:4510");
    expect(baseUrl({}, 5173)).toBe("http://localhost:5173");
  });

  test("preview: serve.js, router server, vite preview", () => {
    expect(previewStep({ port: 4511 }, root, facts({ serveScript: true }), bin, true)).toMatchObject({ args: [`${root}/serve.js`], env: { PORT: "4511" } });
    const server = previewStep({ host: "0.0.0.0" }, root, facts(), bin, true);
    expect(server.args[2]).toBe(startCode("dist"));
    expect(server.env).toEqual({ HOST: "0.0.0.0" });
    expect(previewStep({ port: 4512 }, root, facts({ kind: "spa" }), bin, false).args).toEqual(["/bin/vite", "preview", "--port", "4512"]);
    expect(previewStep({}, root, facts(), bin, false).args).toEqual(["/bin/vite", "preview", "--outDir", "dist/client"]);
  });

  test("prerender: default code or the project's script", () => {
    expect(prerenderStep({}, root).args[2]).toBe(prerenderCode("dist"));
    expect(prerenderStep({ script: "prerender.js" }, root).args).toEqual([`${root}/prerender.js`]);
  });
});

describe("check / typecheck / test", () => {
  test("check: sync + rivet-check for apps; no sync / manifest for libraries", () => {
    expect(commands(checkSteps({}, root, facts(), bin))).toEqual([
      "/bin/@rivetjs/router:rivet sync",
      "/bin/@rivetjs/language-core:rivet-check -p tsconfig.json",
    ]);
    expect(commands(checkSteps({ tsConfig: ["a.json", "b.json"], types: false, format: "json" }, root, facts({ kind: "lib" }), bin))).toEqual([
      "/bin/@rivetjs/language-core:rivet-check -p a.json -p b.json --no-types --no-manifest --format json",
    ]);
  });

  test("typecheck: sync first for apps", () => {
    expect(commands(typecheckSteps({}, root, facts(), bin))).toEqual(["/bin/@rivetjs/router:rivet sync", "/bin/typescript:tsc -p tsconfig.json --noEmit"]);
    expect(commands(typecheckSteps({ tsConfig: "tsconfig.lib.json" }, root, facts({ kind: "lib" }), bin))).toEqual([
      "/bin/typescript:tsc -p tsconfig.lib.json --noEmit",
    ]);
  });

  test("test: vitest run + flags", () => {
    expect(testStep({}, root, bin).args).toEqual(["/bin/vitest", "run", "--passWithNoTests"]);
    expect(
      testStep(
        {
          watch: true,
          coverage: true,
          maxWorkers: 2,
          passWithNoTests: false,
          update: true,
          project: ["dom"],
          testFiles: ["Counter"],
          reporters: ["dot"],
          testNamePattern: "counts",
        },
        root,
        bin,
      ).args,
    ).toEqual([
      "/bin/vitest",
      "Counter",
      "--coverage",
      "--maxWorkers",
      "2",
      "--update",
      "--testNamePattern",
      "counts",
      "--project",
      "dom",
      "--reporter",
      "dot",
    ]);
  });

  test("flags helper", () => {
    expect(
      flags([
        ["--a", 1],
        ["--b", true],
        ["--c", false],
        ["--d", undefined],
        ["--e", "x"],
      ]),
    ).toEqual(["--a", "1", "--b", "--e", "x"]);
  });
});

describe("package", () => {
  test("options, emit step, path mapping, manifest", () => {
    const options = normalizePackageOptions({}, "/ws", "/ws/libs/kit");
    expect(options).toEqual({ root: "/ws/libs/kit", out: "/ws/dist/libs/kit", tsConfig: "tsconfig.lib.json", sourceRoot: "src", assets: [] });
    expect(emitStep(options, bin).args).toEqual(["/bin/typescript:tsc", "-p", "tsconfig.lib.json", "--outDir", "/ws/dist/libs/kit"]);
    expect(mapPath("./src/button/index.ts", "src", false)).toBe("./button/index.js");
    expect(mapPath("./src/button/index.ts", "src", true)).toBe("./button/index.d.ts");
    expect(mapPath("./src/Card.tsx", "src", false)).toBe("./Card.jsx");
    expect(mapPath("./src/styles.css", "src", false)).toBe("./styles.css");
    expect(
      distManifest(
        {
          name: "@acme/kit",
          private: true,
          scripts: { x: "y" },
          devDependencies: { vitest: "^5" },
          exports: { ".": { types: "./src/index.ts", default: "./src/index.ts" }, "./card": "./src/card/index.ts" },
        },
        "src",
      ),
    ).toEqual({ name: "@acme/kit", exports: { ".": { types: "./index.d.ts", default: "./index.js" }, "./card": "./card/index.js" } });
  });
});

test("packageDir finds workspace packages", () => {
  expect(packageDir("vite", import.meta.dirname)).toMatch(/node_modules\/vite$/);
  expect(() => packageDir("no-such-package-xyz", import.meta.dirname)).toThrow(/cannot find/);
});

test("JSON check hides successful sync output and forwards diagnostic controls", () => {
  const steps = checkSteps({ format: "json", quiet: true, verbose: true }, root, facts(), bin);
  expect(steps[0]!.quietSuccess).toBe(true);
  expect(steps[0]!.args).toEqual(["/bin/@rivetjs/router:rivet", "sync", "--json", "--quiet"]);
  expect(steps[1]!.args).toContain("--format");
  expect(steps[1]!.args).toContain("--quiet");
  expect(steps[1]!.args).toContain("--verbose");
});
