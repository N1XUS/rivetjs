// Next.js lane of apps/island-bench: App Router, per-request SSR (`dynamic = "force-dynamic"`), the shared React
// components as client components (`app/islands.jsx`). node_modules = symlink to apps/editorial-bench/lanes/next/node_modules.
import { fileURLToPath } from "node:url";

export default {
  poweredByHeader: false,
  // No compression in any lane (Astro's standalone server has none): the bench measures the framework's render.
  compress: false,
  // Build workers capped (the editorial bench measured the default CPUs − 1 workers over the RSS cap).
  experimental: { cpus: 2 },
  // The shared components live in apps/island-bench/components (outside this folder).
  turbopack: { root: fileURLToPath(new URL("../../../..", import.meta.url)) },
  outputFileTracingRoot: fileURLToPath(new URL("../../../..", import.meta.url)),
};
