import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// Compression dictionary transport (dictionary-e2e.test.ts): a static site with client navigation (`_data.json`).
export default defineConfig({ plugins: [rivetRouter({ mode: "static", clientRouter: true })], logLevel: "warn" });
