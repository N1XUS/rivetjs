import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "iOS style picker",
  summary: "embla's IOS Style Picker example: vertical drag-free carousels with embla's translate off, drawn as 3D wheels from the scroll progress.",
  tags: ["carousel", "picker", "css"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/components/IosPickerItem.tsx", "src/styles.css"],
  test: [
    { attr: ["#hours", "data-ready", "true"] },
    { matches: '#hours-slide-0[style*="opacity: 1"]' },
    { matches: '#hours-viewport > div[style*="rotateX"]' },
    { attr: ["#minutes", "data-ready", "true"] },
  ],
});
