import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Looping carousel",
  summary: "loop repositions the slides so the carousel wraps around: previous on the first slide goes to the last, and drags never hit an edge.",
  tags: ["carousel", "loop", "tailwind"],
  status: "experimental",
  frame: { height: 240, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#looped", "data-loop", "true"] },
    { attr: ["#prev", "data-disabled", null] },
    { click: "#prev" },
    { attr: ["#looped-slide-4", "data-snapped", "true"] },
    { click: "#next" },
    { attr: ["#looped-slide-0", "data-snapped", "true"] },
  ],
});
