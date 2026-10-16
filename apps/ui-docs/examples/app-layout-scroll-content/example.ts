import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AppLayout: Content scroll mode",
  summary: 'scrollMode="content": the layout fills the viewport and only the main area scrolls.',
  tags: ["app-layout", "layout"],
  status: "experimental",
  frame: {
    height: 420,
    width: "full",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ['[data-app-layout="app-layout-scroll-content"]', "data-scroll-mode", "content"],
    },
  ],
});
