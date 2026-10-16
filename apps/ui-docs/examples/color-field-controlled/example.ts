import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorField: Controlled",
  summary: 'ColorField demo "Controlled".',
  tags: ["color-field"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["[data-slot=description]", "#0485F7"] },
    { click: "button:text('Set Red')" },
    { expect: ["[data-slot=description]", "#EF4444"] },
    { click: "button:text('Clear')" },
    { expect: ["[data-slot=description]", "(empty)"] },
  ],
});
