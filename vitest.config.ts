// Vitest projects: one per library / app test suite (`vitest run --project <name>`; nx `test` targets
// select theirs). Suites run in forked processes like `node --test` did, without a per-test timeout.
import { defineConfig, defineProject, type TestProjectConfiguration } from "vitest/config";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { svelte as sveltePlugin } from "@sveltejs/vite-plugin-svelte";
import vuePlugin from "@vitejs/plugin-vue";
import { playwright } from "@vitest/browser-playwright";
import { nodeConditions, rivetTest } from "./libs/testing/vite.ts";

const node = (name: string, include: string[], test: Record<string, unknown> = {}): TestProjectConfiguration =>
  defineProject({
    extends: true,
    plugins: [nodeConditions()],
    test: { name, include, environment: "node", setupFiles: ["libs/testing/node-env.ts"], ...test },
  });

const solidPackage = fileURLToPath(new URL("./libs/bridge-solid/node_modules/solid-js/", import.meta.url));
const solidModule = createRequire(new URL("./libs/bridge-solid/package.json", import.meta.url))("vite-plugin-solid");
const solidPlugin = solidModule.default ?? solidModule;
function foreignProject(name: string, framework: "solid" | "vue" | "svelte", client: boolean): TestProjectConfiguration {
  const project = (client ? browser : node)(
    name,
    [`libs/bridge-${framework}/tests/${client ? "*.browser.test.{ts,tsx}" : "*.test.ts"}`],
    client ? {} : { exclude: ["**/*.browser.test.*"], ...(framework === "solid" ? { experimental: { viteModuleRunner: true } } : {}) },
  );
  const plugins =
    framework === "solid"
      ? [solidPlugin({ ssr: true, dev: false, hot: false, include: /\.solid\.[jt]sx$/, solid: { delegateEvents: false } })]
      : framework === "vue"
        ? [vuePlugin()]
        : sveltePlugin({
            configFile: false,
            compilerOptions: { css: "external" },
            dynamicCompileOptions: ({ filename }) => (filename.endsWith("/AsyncBody.svelte") ? { experimental: { async: true } } : undefined),
          });
  return defineProject({
    ...project,
    plugins: [...plugins, ...(project.plugins ?? [])],
    ...(framework === "solid"
      ? {
          resolve: {
            alias: [
              { find: /^solid-js\/web$/, replacement: solidPackage + `web/dist/${client ? "web" : "server"}.js` },
              { find: /^solid-js\/store$/, replacement: solidPackage + `store/dist/${client ? "store" : "server"}.js` },
              { find: /^solid-js$/, replacement: solidPackage + `dist/${client ? "solid" : "server"}.js` },
              { find: /^solid-js\/html$/, replacement: solidPackage + "html/dist/html.js" },
              { find: /^solid-js\/h$/, replacement: solidPackage + "h/dist/h.js" },
            ],
          },
        }
      : {}),
  });
}

/** The same suite under `--conditions=development` with the recording devtools hook. */
const dev = (name: string, include: string[], test: Record<string, unknown> = {}): TestProjectConfiguration =>
  node(name, include, {
    execArgv: ["--conditions=development", "--import", "./libs/reactivity/tests/dev-hook.ts"],
    ...test,
  });

/** cdk node suites that assert dev-only warnings (`DEV` from cdk `#dev`): run under the `development` condition. */
const CDK_DEV = [
  "libs/cdk/tests/progress-bar-behaviour.test.ts",
  "libs/cdk/tests/controllable.test.ts",
  "libs/cdk/tests/label-warning.test.ts",
  "libs/cdk/tests/scheduler-dev.test.ts",
];

/**
 * Absolute perf budgets (a latency / frame-time bound in ms) hold on the hardware they were set on, not on CI's shared
 * 2-vCPU runners (`CI` set: GitHub Actions), where they only log; `RIVET_PERF_BUDGETS=1` enforces them anyway. Node
 * suites read `process.env`; browser suites `inject("rivetPerfBudgets")`. The benchmark lanes are the perf gates.
 */
const PERF_BUDGETS = !process.env.CI || process.env.RIVET_PERF_BUDGETS === "1";

/** Real Chromium (Vitest browser mode): suites that need a full DOM (layout, shadow DOM event paths). */
const browser = (name: string, include: string[], test: Record<string, unknown> = {}): TestProjectConfiguration =>
  defineProject({
    plugins: [rivetTest()],
    test: {
      name,
      include,
      testTimeout: 0,
      hookTimeout: 0,
      // Headless cursor guard (CI's virtual cursor at (0, 0) dispatches no unscripted hover): libs/testing/headless-cursor.ts.
      setupFiles: ["libs/testing/browser-env.ts"],
      provide: { rivetPerfBudgets: PERF_BUDGETS },
      browser: { enabled: true, provider: playwright(), headless: true, instances: [{ browser: "chromium" }] },
      ...test,
    },
  });

export default defineConfig({
  test: {
    pool: "forks",
    // Native `import` (Node's type stripping and resolution), not Vite's module runner: suites run as
    // they did under `node --test`; `.tsx` goes through the Rivet loader hook.
    experimental: { viteModuleRunner: false },
    execArgv: ["--import", "@rivetjs/runtime/testing/register"],
    testTimeout: 0,
    hookTimeout: 0,
    projects: [
      node("reactivity", ["libs/reactivity/tests/*.test.ts"]),
      dev("reactivity-dev", ["libs/reactivity/tests/*.test.ts"]),
      node("runtime", ["libs/runtime/tests/*.test.ts"]),
      // The production-resolution check only holds without the development condition.
      dev("runtime-dev", ["libs/runtime/tests/*.test.ts"], { testNamePattern: /^(?!production \(default resolution\))/ }),
      node("compiler", ["libs/compiler/tests/*.test.ts"]),
      node("router", ["libs/router/tests/*.test.ts"]),
      node("forms", ["libs/forms/tests/*.test.ts"]),
      node("i18n", ["libs/i18n/tests/*.test.ts"]),
      node("kit", ["libs/kit/tests/*.test.ts"], { exclude: ["**/*.browser.test.*"] }),
      browser("kit-browser", ["libs/kit/tests/*.browser.test.{ts,tsx}"]),
      node("motion", ["libs/motion/tests/*.test.ts"], { exclude: ["**/*.browser.test.*"] }),
      browser("motion-browser", ["libs/motion/tests/*.browser.test.{ts,tsx}"]),
      node("bridge", ["libs/bridge/tests/*.test.ts"], { exclude: ["**/*.browser.test.*"] }),
      browser("bridge-browser", ["libs/bridge/tests/*.browser.test.{ts,tsx}"]),
      node("bridge-react", ["libs/bridge-react/tests/*.test.ts"], { exclude: ["**/*.browser.test.*"] }),
      browser("bridge-react-browser", ["libs/bridge-react/tests/*.browser.test.{ts,tsx}"]),
      node("bridge-preact", ["libs/bridge-preact/tests/*.test.ts"], { exclude: ["**/*.browser.test.*"] }),
      browser("bridge-preact-browser", ["libs/bridge-preact/tests/*.browser.test.{ts,tsx}"]),
      foreignProject("bridge-solid", "solid", false),
      foreignProject("bridge-solid-browser", "solid", true),
      foreignProject("bridge-vue", "vue", false),
      foreignProject("bridge-vue-browser", "vue", true),
      foreignProject("bridge-svelte", "svelte", false),
      foreignProject("bridge-svelte-browser", "svelte", true),
      node("devtools", ["libs/devtools/tests/*.test.ts"], { exclude: ["**/*.dev.test.*"] }),
      // Development-build suites (`#dev` → dev-on: e.g. `@rivetjs/bridge/adapter` islandRecovered's hook event).
      dev("devtools-dev", ["libs/devtools/tests/*.dev.test.ts"]),
      node("language-core", ["libs/language-core/tests/*.test.ts"]),
      node("typescript-plugin", ["libs/typescript-plugin/tests/*.test.ts"]),
      node("testing", ["libs/testing/tests/*.test.ts"], { exclude: ["**/*.browser.test.*"] }),
      browser("testing-browser", ["libs/testing/tests/*.browser.test.{ts,tsx}"]),
      node("cdk", ["libs/cdk/tests/*.test.ts", "libs/cdk/tests/browser/*.test.ts", "libs/cdk/tests/date/*.test.ts"], { exclude: CDK_DEV }),
      // Suites asserting cdk dev-only warnings (`#dev` → `utils/dev-on.ts` needs the `development` condition).
      dev("cdk-dev", CDK_DEV),
      // + the react-resizable-panels engine suite (upstream test tree mirrored under tests/resizable/)
      browser("cdk-browser", ["libs/cdk/tests/*.browser.test.tsx", "libs/cdk/tests/resizable/**/*.test.ts"]),
      // Story-app suites share one production build (built once per run by `global-setup.ts`) and Chromium: one file at a time.
      node("cdk-components", ["libs/cdk/tests-components/*.test.ts"], {
        fileParallelism: false,
        globalSetup: ["libs/cdk/tests-components/global-setup.ts"],
      }),
      node("ui", ["libs/ui/tests/*.test.{ts,tsx}"]),
      node("ui-components", ["libs/ui/tests-components/*.test.ts"], {
        fileParallelism: false,
        globalSetup: ["libs/ui/tests-components/global-setup.ts"],
      }),
      // Resume fuzz (`@rivetjs/testing/fuzz`): every story route resumed vs CSR. Chromium, one app at a time (never both
      // at once), `--maxWorkers=1`; `RIVET_FUZZ_SHARD=i/n` / `RIVET_FUZZ_ROUTES=` / `RIVET_FUZZ_STEPS=` select.
      node("cdk-resume-fuzz", ["libs/cdk/tests-fuzz/*.test.ts"], { fileParallelism: false }),
      node("ui-resume-fuzz", ["libs/ui/tests-fuzz/*.test.ts"], { fileParallelism: false }),
      node("docs-kit", ["libs/docs-kit/tests/*.test.ts"]),
      node("create-rivet", ["libs/create-rivet/tests/*.test.ts"]),
      node("mcp", ["libs/mcp/tests/*.test.ts"]),
      // @rivetjs/nx: generators / inference / executors on in-memory trees + an e2e Nx workspace (`e2e.test.ts`).
      node("nx", ["libs/nx/tests/*.test.ts"]),
      node("scripts", ["scripts/tests/*.test.ts"]),
      // Backend examples (examples/CLAUDE.md): build + boot each example on in-process fakes / node:sqlite; no Docker, no network.
      node("examples", ["examples/*/tests/*.test.ts"], { testTimeout: 180_000, hookTimeout: 180_000 }),
      node("docs", ["apps/docs/tests/*.test.ts"]),
      node("ui-docs", ["apps/ui-docs/tests/*.test.ts"]),
      node("dom-bench", ["apps/dom-bench/tests/*.test.ts"]),
      node("playground", ["apps/playground/tests/*.test.ts"]),
      node("vscode", ["apps/vscode/tests/*.test.ts"]),
      // ssr-bench: the CI subset; `ssr-bench-all` holds the endpoint-driven integration suites too
      // (`SSR_BENCH_ENDPOINTS=… vitest run --project ssr-bench-all apps/ssr-bench/tests/integration.test.ts`).
      node(
        "ssr-bench",
        ["rest", "adapters", "compiled-adapter", "emitter", "loadgen", "router-lane", "page-decoder", "content-server"].map(
          (name) => `apps/ssr-bench/tests/${name}.test.ts`,
        ),
      ),
      node("ssr-bench-all", ["apps/ssr-bench/tests/*.test.ts"]),
    ],
  },
});
