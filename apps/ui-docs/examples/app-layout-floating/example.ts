import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AppLayout: Floating",
  summary: 'sidebarVariant="floating": the sidebar floats as a rounded panel.',
  tags: ["app-layout", "layout"],
  status: "experimental",
  frame: { height: 516, auto: true, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ['[data-app-layout="app-layout-floating"] > [data-slot="sidebar"]', "data-variant", "floating"],
    },
  ],
});
