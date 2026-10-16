// Astro lane of apps/editorial-bench: static output (default), zero client JS, no prefetch, no image service use.
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  outDir: "./dist",
  trailingSlash: "always",
  build: { format: "directory" },
  prefetch: false,
  devToolbar: { enabled: false },
  telemetry: false,
});
