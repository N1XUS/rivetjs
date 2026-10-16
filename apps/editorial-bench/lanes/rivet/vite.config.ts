import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// EDITORIAL_MODE=static (default): pages prerendered to dist/client (rivet lane).
// EDITORIAL_MODE=server: node adapter build into dist-dynamic/, rendered per request (rivet-dynamic lane).
const mode = process.env.EDITORIAL_MODE === "server" ? "server" : "static";
export default defineConfig({
  plugins: [rivetRouter({ mode })],
  logLevel: "warn",
});
