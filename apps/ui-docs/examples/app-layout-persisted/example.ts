import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AppLayout: Persisted sizes",
  summary: "resizableAutoSaveId stores the panel sizes in localStorage; the open states persist in cookies.",
  tags: ["app-layout", "layout"],
  status: "experimental",
  frame: { height: 516, auto: true, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    {
      press: ['[data-slot="app-layout-sidebar-handle"]', "End"],
    },
    {
      attr: ['[data-slot="app-layout-sidebar-handle"]', "aria-valuenow", "30"],
    },
  ],
});
