// SvelteKit lane of apps/editorial-bench: adapter-static, every page prerendered, default CSR (hydration) kept.
import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter({ pages: "dist", assets: "dist", fallback: undefined, precompress: false, strict: true }),
      prerender: { handleHttpError: "fail", handleMissingId: "ignore" },
    }),
  ],
  logLevel: "warn",
});
