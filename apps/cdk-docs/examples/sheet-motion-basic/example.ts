import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "sheetMotion: drag, snap and dismiss an edge sheet",
  summary:
    "@rivetjs/cdk/sheet-motion attaches the sheet gesture to any element: drag it down to dismiss, release between two snap points, or drive it with snapTo() / dismiss().",
  tags: ["motion", "sheet", "gesture", "tailwind"],
  status: "experimental",
  frame: { height: 288, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: "#open" },
    { attr: ["#sheet", "data-open", "true"] },
    { click: "#peek" },
    { attr: ["#sheet", "data-settled", "124"] },
    { click: "#dismiss" },
    { attr: ["#sheet", "data-settled", "closed"] },
  ],
});
