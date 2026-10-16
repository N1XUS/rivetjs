import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// `vite build --ssr` also emits `dist/server/fetch.js` (fetch/edge adapter, manifests inlined).
export default defineConfig({ plugins: [rivetRouter({ styles: ["src/styles.css"], adapter: "fetch" })], logLevel: "warn" });
