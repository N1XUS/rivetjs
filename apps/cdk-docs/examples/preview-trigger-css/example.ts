import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PreviewTrigger with plain CSS",
  summary:
    "No utilities: rules for rv-Popover[data-trigger=PreviewTrigger], rv-OverlayArrow and [data-placement], and a data-entering animation from --trigger-anchor-point.",
  tags: ["preview-trigger", "css"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { key: "Tab" },
    { focused: "#ptcss-link" },
    { matches: "#ptcss-preview.rv-Popover[data-trigger=PreviewTrigger][data-placement=bottom]" },
    { matches: "#ptcss-preview .rv-OverlayArrow[data-placement=bottom] > .tip" },
    { key: "Escape" },
    { absent: "#ptcss-preview" },
  ],
});
