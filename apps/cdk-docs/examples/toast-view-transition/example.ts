import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toast view transitions",
  summary:
    "wrapUpdate runs every queue update inside document.startViewTransition, so toasts animate in and out with ::view-transition-* CSS (each toast gets its own view-transition-name).",
  tags: ["toast", "animation", "view-transition"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ click: "#tvt-add" }, { matches: ".rv-Toast" }, { click: ".rv-Toast .close" }, { absent: ".rv-Toast" }],
});
