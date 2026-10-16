import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toast timeout and programmatic close",
  summary:
    "add(content, { timeout, onClose }) auto-dismisses after the timeout (paused while the region is hovered or focused); queue.close(key) closes a toast from code.",
  tags: ["toast", "timeout", "controlled"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    // A sticky toast, closed from code with the key `add` returned.
    { click: "#tt-toggle" },
    { matches: ".rv-Toast" },
    { expect: ["#tt-toggle", "Hide toast"] },
    { click: "#tt-toggle" },
    { absent: ".rv-Toast" },
    { expect: ["#tt-log", "closed: Sticky"] },
    // A timed toast closes itself (React Aria recommends 5 s or more in real apps).
    { click: "#tt-timed" },
    { matches: ".rv-Toast" },
    { absent: ".rv-Toast" },
    { expect: ["#tt-log", "closed: Timed"] },
  ],
});
