import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Class names",
  summary: "embla's Class Names example: the ClassNames plugin adds is-snapped to the selected slide; CSS dims the others to 16%.",
  tags: ["carousel", "plugin", "css"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#classes-viewport.is-draggable" },
    { matches: "#classes-slide-0.is-snapped" },
    { click: "#next" },
    { matches: "#classes-slide-1.is-snapped" },
    { absent: "#classes-slide-0.is-snapped" },
    { click: "#prev" },
    { matches: "#classes-slide-0.is-snapped" },
  ],
});
