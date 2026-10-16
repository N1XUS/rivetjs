import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";
import { kit } from "@rivetjs/kit/vite";

export default defineConfig({ plugins: [kit(), rivetRouter()], logLevel: "warn" });
