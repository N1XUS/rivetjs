import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// Forms demo app (file routes, resumed): signup form and a three-step wizard.
export default defineConfig({ plugins: [rivetRouter({ styles: ["src/styles.css"] })], logLevel: "warn" });
