// Next.js lane of apps/bridge-demo: App Router, per-request SSR (`dynamic = "force-dynamic"`), the shared React
// components (../components) as client components.
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../../..", import.meta.url));
export default {
  poweredByHeader: false,
  // No compression in either lane (the Rivet server's gzip is off too).
  compress: false,
  // Build workers capped (3 GB host cap).
  experimental: { cpus: 2 },
  // The shared components live in apps/bridge-demo/components (outside this folder).
  turbopack: { root: repo },
  outputFileTracingRoot: repo,
};
