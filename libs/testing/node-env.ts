// Vitest setup file: a plain `node` process environment. Undo the `NODE_ENV=test` Vitest sets, so builds,
// dev servers and libraries that read NODE_ENV behave as under `node --test`.
if (process.env.NODE_ENV === "test") delete process.env.NODE_ENV;
// Plain `node` keeps source maps off: Vite's SSR stack rewriting (dev error pages) expects raw stacks.
process.setSourceMapsEnabled(false);
