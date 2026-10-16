import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "scrollWheelProps",
  summary: "A zoomable box: the wheel changes the zoom instead of scrolling the page (Ctrl+wheel is left to the browser).",
  tags: ["cdk", "interactions"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["#zoom", "Zoom 100%"] }, { matches: "#zoomable" }],
});
