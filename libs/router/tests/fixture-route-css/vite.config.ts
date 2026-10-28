import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// Route sheets vs Vite's CSS preload lists (`route-css.test.ts`): per-component stylesheets merged per route.
export default defineConfig({ plugins: [rivetRouter({ mode: "static", inlineStylesheets: "never" })], logLevel: "warn" });
