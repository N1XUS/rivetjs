import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// Document prefetch: unmarked links default to `document`; `<Link prefetch>` / `data-rivet-prefetch` override.
export default defineConfig({ plugins: [rivetRouter({ mode: "static", prefetch: "document" })], logLevel: "warn" });
