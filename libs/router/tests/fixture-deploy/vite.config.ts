import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// `tests/deploy.test.ts` builds this app once per deploy target with an inline config (same plugin options + `adapter`).
export default defineConfig({ plugins: [rivetRouter({ clientRouter: true, styles: ["src/styles.css"], adapter: "vercel" })], logLevel: "warn" });
