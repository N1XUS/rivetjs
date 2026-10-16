import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AppLayout: Inset",
  summary: 'sidebarVariant="inset": the page sits on a raised, rounded surface next to the sidebar.',
  tags: ["app-layout", "layout"],
  status: "experimental",
  frame: { height: 532, auto: true, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ['[data-app-layout="app-layout-inset"] > [data-slot="sidebar"]', "data-variant", "inset"],
    },
  ],
});
