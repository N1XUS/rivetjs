// Next.js lane of apps/editorial-bench: App Router, static export, no image optimisation, no <Link> prefetch (plain <a>).
import { fileURLToPath } from "node:url";

export default {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  // NEXT_CPUS: build worker count (variant next-cpus2: the default, CPUs − 1 workers, exceeds the 2.8 GB build RSS cap at N ≥ 1000 on a 14-core host; 4 workers too at N = 5000).
  ...(process.env.NEXT_CPUS ? { experimental: { cpus: Number(process.env.NEXT_CPUS) } } : {}),
  turbopack: { root: fileURLToPath(new URL("../..", import.meta.url)) },
};
