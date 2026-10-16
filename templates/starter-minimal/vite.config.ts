import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({ plugins: [rivetRouter({ mode: "static" })] });
