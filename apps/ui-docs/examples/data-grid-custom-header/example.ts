import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid: Custom Header Rendering",
  summary: "A function `header` gets the sort state (an accessor) and renders its own label.",
  tags: ["data-grid"],
  status: "experimental",
  frame: { height: 361, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "thead th[data-column=joined]",
    },
    {
      expect: ["thead th[data-column=joined]", "Joined (oldest first)"],
    },
  ],
});
