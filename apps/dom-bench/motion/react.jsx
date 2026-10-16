// Motion suite, react lane: React 19 + `motion/react` (the same scenarios; relayout = Motion's `layout` on a CSS grid
// of 1000 items, the closest React equivalent of a masonry relayout).
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { motion } from "motion/react";
import { useState } from "react";
import { STAGGER } from "./shape.ts";

const host = document.getElementById("host");
let root;
let expand;
const variants = { hidden: { opacity: 0, y: STAGGER.y }, show: { opacity: 1, y: 0 } };

function Grid({ count }) {
  const [expanded, setExpanded] = useState(-1);
  expand = () => setExpanded(0);
  return (
    <div style={{ width: 1200, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
      {Array.from({ length: count }, (_, i) => (
        <motion.div key={i} layout style={{ gridColumn: expanded === i ? "span 2" : undefined, aspectRatio: [1, 0.66, 1.5, 0.8][i % 4] }}>
          {"p" + i}
        </motion.div>
      ))}
    </div>
  );
}

function view(scenario, count) {
  const rows = Array.from({ length: count }, (_, i) => i);
  if (scenario === "mount")
    return (
      <ul>
        {rows.map((i) => (
          <motion.li key={i} animate={{ opacity: 1 }}>
            {"row " + i}
          </motion.li>
        ))}
      </ul>
    );
  if (scenario === "stagger")
    return (
      <motion.ul initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: STAGGER.each } } }}>
        {rows.map((i) => (
          <motion.li key={i} variants={variants} transition={{ duration: STAGGER.duration }}>
            {"row " + i}
          </motion.li>
        ))}
      </motion.ul>
    );
  return <Grid count={count} />;
}

window.motionBench = {
  mount(scenario, count) {
    root = createRoot(host);
    flushSync(() => root.render(view(scenario, count)));
  },
  relayout: () => flushSync(() => expand()),
  dispose() {
    root?.unmount();
    root = undefined;
  },
};
