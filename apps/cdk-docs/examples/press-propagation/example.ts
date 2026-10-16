import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Press propagation",
  summary: "Press events stop at the innermost pressable; continuePropagation() lets the parent's native listener see the event too.",
  tags: ["cdk", "interactions", "press"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#stop" },
    { expect: ["#log", "stop"] },
    { expect: ["#parent-count", "Card clicks: 0"] },
    { click: "#pass" },
    { expect: ["#log", "pass"] },
    { expect: ["#parent-count", "Card clicks: 1"] },
  ],
});
