import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// cdk story app (file routes, resumed): one page per component, used by the browser tests.
export default defineConfig({ plugins: [rivetRouter({ clientRouter: true, styles: ["src/styles.css"] })], logLevel: "warn" });
