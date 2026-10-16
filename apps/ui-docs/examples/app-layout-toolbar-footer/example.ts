import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AppLayout: Toolbar and footer",
  summary: "toolbar renders a bar under the navbar, footer one under the content.",
  tags: ["app-layout", "layout"],
  status: "experimental",
  frame: { height: 598, auto: true, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ['[data-slot="app-layout-toolbar"]', "Filters: active projects"],
    },
    {
      expect: ['[data-slot="app-layout-footer"]', "Last synced a minute ago"],
    },
  ],
});
