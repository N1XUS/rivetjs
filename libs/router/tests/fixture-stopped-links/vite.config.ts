import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// Stopped link clicks (`tests/stopped-links.test.ts`): a resumed link handler that stops propagation still routes.
export default defineConfig({ plugins: [rivetRouter({ clientRouter: true })], logLevel: "warn" });
