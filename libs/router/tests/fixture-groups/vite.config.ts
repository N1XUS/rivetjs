import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// Nested path-less groups (`(site)/careers/(jobs)/<slug>`), static mode, transitions: client navigation in dev and builds.
export default defineConfig({ plugins: [rivetRouter({ mode: "static", transitions: true })], logLevel: "warn" });
