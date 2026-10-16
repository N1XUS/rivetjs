// Vitest projects: one per library / app test suite (`vitest run --project <name>`; nx `test` targets
// select theirs). Suites run in forked processes like `node --test` did, without a per-test timeout.
import { defineConfig, defineProject, type TestProjectConfiguration } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { nodeConditions, rivetTest } from "./libs/testing/vite.ts";

const node = (name: string, include: string[], test: Record<string, unknown> = {}): TestProjectConfiguration =>
  defineProject({
    extends: true,
    plugins: [nodeConditions()],
    test: { name, include, environment: "node", setupFiles: ["libs/testing/node-env.ts"], ...test },
  });

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

/** Real Chromium (Vitest browser mode): suites that need a full DOM (layout, shadow DOM event paths). */
const browser = (name: string, include: string[], test: Record<string, unknown> = {}): TestProjectConfiguration =>
  defineProject({
    plugins: [rivetTest()],
    test: {
      name,
      include,
      testTimeout: 0,
      hookTimeout: 0,
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
      // Story-app suites share one production build and Chromium: one file at a time.
      node("cdk-components", ["libs/cdk/tests-components/*.test.ts"], { fileParallelism: false }),
      node("ui", ["libs/ui/tests/*.test.{ts,tsx}"]),
      node("ui-components", ["libs/ui/tests-components/*.test.ts"], { fileParallelism: false }),
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
