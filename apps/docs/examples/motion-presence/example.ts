import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Motion presence",
  summary: "A notice that fades out before it unmounts, and a list whose removed rows play an exit animation in place.",
  tags: ["motion", "presence", "lists"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#notice" },
    { click: "#toggle" },
    { absent: "#notice" },
    { click: "#toggle" },
    { matches: "#notice" },
    { expect: ["#tasks", "Write docs"] },
    { click: "#done-1" },
    { absent: "#task-1" },
    { click: "#add" },
    { matches: "#task-4" },
  ],
});
