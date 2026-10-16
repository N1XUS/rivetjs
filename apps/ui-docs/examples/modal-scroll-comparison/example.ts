import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Modal: Scroll Behavior",
  summary: 'Modal demo "Scroll Behavior".',
  tags: ["modal"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=radio]:nth-of-type(2) [data-slot=radio-content]" },
    { click: "button" },
    { matches: "[role=dialog].modal__dialog--scroll-outside" },
    { key: "Escape" },
    { absent: "[role=dialog]" },
  ],
});
