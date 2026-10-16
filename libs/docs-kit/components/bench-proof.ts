// Browser half of BenchProof.tsx (a .ts module: not server-rewritten). Marks the section as seen so the
// CSS transition grows its bars once (bench-chart.css; nothing moves under prefers-reduced-motion).
export function reveal(root: HTMLElement): void {
  root.setAttribute("data-in", "");
}
