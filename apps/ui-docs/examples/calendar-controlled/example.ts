import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: Controlled",
  summary: 'Calendar demo "Controlled".',
  tags: ["calendar"],
  status: "experimental",
  frame: { height: 424, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "text=Set Christmas" },
    { expect: ["[data-slot=description]", "Selected date: 2025-12-25"] },
    { click: "text=Clear" },
    { expect: ["[data-slot=description]", "(none)"] },
  ],
});
