import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// `trailingSlash: "always"`: `/about` answers 308 → `/about/`; links and navigate() write the slash.
export default defineConfig({ plugins: [rivetRouter({ clientRouter: true, trailingSlash: "always" })], logLevel: "warn" });
