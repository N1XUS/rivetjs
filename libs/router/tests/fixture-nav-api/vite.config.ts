import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({ plugins: [rivetRouter({ styles: ["src/styles.css"] })], logLevel: "warn" });
