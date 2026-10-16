import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// aria story app (file routes, resumed): one page per component, used by the browser tests.
export default defineConfig({ plugins: [rivetRouter({ styles: ["src/styles.css"] })], logLevel: "warn" });
