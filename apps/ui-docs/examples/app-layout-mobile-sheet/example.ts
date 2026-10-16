import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AppLayout: Mobile sheet",
  summary: 'asideMobile="sheet": below 1024px the aside opens as a sheet; AppLayout.MobileAside content renders only there.',
  tags: ["app-layout", "layout"],
  status: "experimental",
  frame: { height: 516, auto: true, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ['[data-app-layout="app-layout-mobile-sheet"]', "data-aside-mobile", "sheet"],
    },
    {
      attr: ["#app-layout-mobile-sheet-aside-trigger", "data-sheet", "true"],
    },
  ],
});
