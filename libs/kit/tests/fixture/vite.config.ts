import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";
import { kit } from "@rivetjs/kit/vite";

// `/shell`: route rule `shell` (a hole's head components on shell cache hits, PPR-T57).
export default defineConfig({ plugins: [kit(), rivetRouter({ clientRouter: true, routeRules: { "/shell": { shell: { maxAge: 3600 } } } })], logLevel: "warn" });
