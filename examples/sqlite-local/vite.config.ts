import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// Pages render on the server per request; `*.server.ts` modules (the SQLite access) never reach the browser build.
export default defineConfig({ plugins: [rivetRouter({ styles: ["src/styles.css"] })], logLevel: "warn" });
