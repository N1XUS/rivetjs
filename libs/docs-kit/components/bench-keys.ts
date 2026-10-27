// Keyboard reading of a `BenchChart` plot (browser only: a .ts module, not server-rewritten). The plot is server HTML
// (`BenchChart.tsx`); hover tooltips are CSS. The docs page script (`page-script.ts`) bundles this module and calls it when a plot gets
// keyboard focus or a key: arrows / Home / End mark a row active (`data-active`: its tooltip shows, `bench-chart.css`) and
// announce it in the plot's polite live region (the row's `data-say`), Escape and blur clear it.

const rows = (plot: Element) => [...plot.querySelectorAll<HTMLElement>(".bench-row")];
const activeIndex = (plot: Element) => rows(plot).findIndex((row) => row.hasAttribute("data-active"));

/** Mark row `index` of `plot` active (−1: none) and announce it. */
export function show(plot: Element, index: number): void {
  const all = rows(plot);
  all.forEach((row, i) => row.toggleAttribute("data-active", i === index));
  const live = plot.querySelector(".bench-live");
  const row = all[index];
  if (live && row) live.textContent = row.dataset.say ?? "";
}

/** Keyboard focus reached the plot: show the active row, else the first. */
export function focus(plot: Element): void {
  show(plot, Math.max(0, activeIndex(plot)));
}

/** A chart key on the focused plot (the caller prevented its default). */
export function key(plot: Element, name: string): void {
  const count = rows(plot).length;
  if (!count) return;
  const at = activeIndex(plot);
  if (name === "Escape") return show(plot, -1);
  const next =
    name === "ArrowDown" || name === "ArrowRight"
      ? Math.min(count - 1, at + 1)
      : name === "ArrowUp" || name === "ArrowLeft"
        ? Math.max(0, at - 1)
        : name === "Home"
          ? 0
          : count - 1;
  show(plot, next);
}

/** Focus left the plot. */
export function blur(plot: Element): void {
  show(plot, -1);
}
