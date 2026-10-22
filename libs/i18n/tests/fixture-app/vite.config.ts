import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";
import { i18n } from "@rivetjs/i18n/vite";
import { config } from "./i18n.config.ts";

export default defineConfig({ plugins: [i18n(config), rivetRouter({ clientRouter: true })], logLevel: "warn" });
