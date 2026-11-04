import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({ plugins: [rivetRouter({ clientRouter: true })], logLevel: "warn" });
