import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// The app is served under /app (routes, links, data requests, assets).
export default defineConfig({ plugins: [rivetRouter({ clientRouter: true, base: "/app", styles: ["src/styles.css"] })], logLevel: "warn" });
