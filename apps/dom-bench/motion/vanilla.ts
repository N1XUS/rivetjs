// Motion suite, vanilla lane (the floor): DOM by hand + `motion` (`animate` + `stagger`; relayout = Motion's
// `animateLayout` over a CSS grid of 1000 items).
import { animate, animateLayout, stagger } from "motion";
import { STAGGER, type MotionBench } from "./shape.ts";

const host = document.getElementById("host")!;
let grid: HTMLElement | undefined;
const list = (count: number) => {
  const ul = document.createElement("ul");
  for (let i = 0; i < count; i++) {
    const li = document.createElement("li");
    li.textContent = "row " + i;
    ul.append(li);
  }
  host.append(ul);
  return ul;
};
const bench: MotionBench = {
  mount(scenario, count) {
    if (scenario === "mount") {
      for (const li of list(count).children) (li as HTMLElement).style.opacity = "1";
      return;
    }
    if (scenario === "stagger") {
      const items = [...list(count).children];
      animate(items, { opacity: [0, 1], y: [STAGGER.y, 0] }, { duration: STAGGER.duration, delay: stagger(STAGGER.each) });
      return;
    }
    grid = document.createElement("div");
    grid.style.cssText = "width:1200px;display:grid;grid-template-columns:repeat(6,1fr);gap:8px";
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.setAttribute("data-layout", "");
      el.style.aspectRatio = String([1, 0.66, 1.5, 0.8][i % 4]);
      el.textContent = "p" + i;
      grid.append(el);
    }
    host.append(grid);
  },
  relayout() {
    const first = grid!.firstElementChild as HTMLElement;
    animateLayout(grid!, () => (first.style.gridColumn = "span 2"), { duration: STAGGER.duration });
  },
  dispose() {
    host.textContent = "";
    grid = undefined;
  },
};
(window as unknown as { motionBench: MotionBench }).motionBench = bench;
