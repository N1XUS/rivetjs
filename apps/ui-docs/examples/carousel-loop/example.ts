import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Loop",
  summary: "loop wraps around: previous on the first slide goes to the last one.",
  tags: ["carousel"],
  status: "experimental",
  frame: { height: 260, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#carousel-loop-prev",
    },
    {
      attr: ["#carousel-loop [role=tab]:last-child", "aria-selected", "true"],
    },
  ],
});
