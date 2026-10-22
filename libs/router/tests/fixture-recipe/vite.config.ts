import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// Recipe "render with data from another server" (EXT-B): a custom node server loads this build with `loadBuild` and
// renders `/splash/survey` with seeded `locals`.
export default defineConfig({ plugins: [rivetRouter()], logLevel: "warn" });
