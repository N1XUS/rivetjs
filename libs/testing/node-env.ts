// Vitest setup file: a plain `node` process environment. Undo the `NODE_ENV=test` Vitest sets, so builds,
// dev servers and libraries that read NODE_ENV behave as under `node --test`.
import { registerHooks } from "node:module";
import { installPlaywrightGuard } from "./headless-cursor.ts";

if (process.env.NODE_ENV === "test") delete process.env.NODE_ENV;
// Plain `node` keeps source maps off: Vite's SSR stack rewriting (dev error pages) expects raw stacks.
process.setSourceMapsEnabled(false);

// Headless cursor guard (`headless-cursor.ts`): every Playwright browser context gets the origin-pointer guard, so CI's
// virtual cursor at (0, 0) dispatches no hover the test did not script. Installed when Playwright loads (a load hook on
// its entry; suites without a browser do not pay for importing it).
const g = globalThis as { __rivetOnPlaywright?: (playwright: unknown) => void };
g.__rivetOnPlaywright = installPlaywrightGuard;
registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (url.endsWith("/playwright-core/index.js") && result.source != null)
      result.source = String(result.source) + "\n;globalThis.__rivetOnPlaywright?.(module.exports);\n";
    return result;
  },
});
