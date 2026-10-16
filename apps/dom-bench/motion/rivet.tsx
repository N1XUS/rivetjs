// Motion suite, rivet lane: `@rivetjs/motion` Motion elements + cdk Masonry relayout (house motion or `layoutDriver`).
import { signal } from "@rivetjs/reactivity";
import { render } from "@rivetjs/runtime/dom";
import { Masonry } from "@rivetjs/cdk/masonry";
import { Motion } from "@rivetjs/motion";
import { animateLayout, layoutDriver } from "@rivetjs/motion/layout";
import { STAGGER, type MotionBench, type Scenario } from "./shape.ts";

const host = document.getElementById("host")!;
let dispose: (() => void) | undefined;
const expanded = signal(-1);
const driver = new URLSearchParams(location.search).get("driver");
const variants = { hidden: { opacity: 0, y: STAGGER.y }, show: { opacity: 1, y: 0 } };

function view(scenario: Scenario, count: number) {
  const rows = Array.from({ length: count }, (_, i) => i);
  if (scenario === "mount")
    return (
      <ul>
        {rows.map((i) => (
          <Motion.li animate={{ opacity: 1 }}>{"row " + i}</Motion.li>
        ))}
      </ul>
    );
  if (scenario === "stagger")
    return (
      <Motion.ul
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: STAGGER.each } } }}
        transition={{ duration: STAGGER.duration }}
      >
        {rows.map((i) => (
          <Motion.li variants={variants} transition={{ duration: STAGGER.duration }}>
            {"row " + i}
          </Motion.li>
        ))}
      </Motion.ul>
    );
  // `?driver=grid`: the same CSS grid as the react / vanilla lanes, `layout` elements + `animateLayout`.
  if (driver === "grid")
    return (
      <div id="grid" style={{ width: "1200px", display: "grid", "grid-template-columns": "repeat(6, 1fr)", gap: "8px" }}>
        {rows.map((i) => (
          <Motion.div layout style={{ "grid-column": expanded() === i ? "span 2" : undefined, "aspect-ratio": String([1, 0.66, 1.5, 0.8][i % 4]) }}>
            {"p" + i}
          </Motion.div>
        ))}
      </div>
    );
  const items = rows.map((i) => ({ id: "p" + i, aspectRatio: [1, 0.66, 1.5, 0.8][i % 4]! }));
  return (
    <div style={{ width: "1200px" }}>
      <Masonry
        items={items}
        columns={6}
        gap={8}
        aria-label="bench"
        motion={driver === "waapi" ? layoutDriver({ duration: STAGGER.duration }) : true}
        getSpan={(p) => () => (expanded() === Number(p.id.slice(1)) ? 2 : 1)}
      >
        {(p) => <span>{p.id}</span>}
      </Masonry>
    </div>
  );
}

const bench: MotionBench = {
  mount(scenario, count) {
    expanded.set(-1);
    dispose = render(() => view(scenario, count), host);
  },
  relayout: () =>
    driver === "grid" ? void animateLayout(document.getElementById("grid"), () => expanded.set(0), { duration: STAGGER.duration }) : expanded.set(0),
  dispose() {
    dispose?.();
    dispose = undefined;
    host.textContent = "";
  },
};
(window as unknown as { motionBench: MotionBench }).motionBench = bench;
