import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drawer: With Form",
  summary: 'Drawer demo "With Form".',
  tags: ["drawer"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button" },
    { matches: "[data-slot=drawer-body] form input[name=email]" },
    { click: "[data-slot=drawer-close-trigger]" },
    { absent: "[role=dialog]" },
  ],
});
