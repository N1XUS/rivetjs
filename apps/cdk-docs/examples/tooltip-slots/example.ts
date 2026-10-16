import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tooltip content",
  summary: "Tooltip children as rich JSX, or a function of the render props ({ placement, isEntering, isExiting, state }); class as a function of them too.",
  tags: ["tooltip", "slots", "render-props"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { key: "Tab" },
    { matches: "#ts-rich strong" },
    { expect: ["#ts-rich", "Shortcut"] },
    { expect: ["#ts-rich kbd", "Ctrl S"] },
    { key: "Tab" },
    { absent: "#ts-rich" },
    { expect: ["#ts-where", "Shown at bottom"] },
    { matches: "#ts-where.rv-Tooltip.side-bottom" },
  ],
});
