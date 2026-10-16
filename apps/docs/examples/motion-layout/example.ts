import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Motion layout",
  summary: "Tabs whose underline glides to the selected tab (layoutId) and a grid that animates its reflow (animateLayout).",
  tags: ["motion", "layout"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#tab-0", "aria-selected", "true"] },
    { click: "#tab-2" },
    { attr: ["#tab-2", "aria-selected", "true"] },
    { matches: "#tab-2 [data-layout-id]" },
    { click: "#shuffle" },
    { matches: "#grid [data-layout]" },
  ],
});
