import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AppLayout: With aside",
  summary: "An aside panel on the right of the main content, toggled by AppLayout.AsideTrigger.",
  tags: ["app-layout", "layout"],
  status: "experimental",
  frame: { height: 516, auto: true, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ["#app-layout-aside-aside", "data-state", "open"],
    },
    {
      click: "#app-layout-aside-aside-trigger",
    },
    {
      attr: ["#app-layout-aside-aside", "data-state", "closed"],
    },
    {
      attr: ["#app-layout-aside-aside-trigger", "aria-expanded", "false"],
    },
  ],
});
