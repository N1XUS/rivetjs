import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Modal: Custom Animations",
  summary: 'Modal demo "Custom Animations".',
  tags: ["modal"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button:nth-of-type(2)" },
    { expect: ["[data-slot=modal-heading]", "Fluid Slide Animation"] },
    { key: "Escape" },
    { absent: "[role=dialog]" },
  ],
});
