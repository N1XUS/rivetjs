import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: iOS picker loop",
  summary: "embla's IOS Picker Loop example on the ui Carousel: the hours / minutes wheels wrap around (loop).",
  tags: ["carousel", "picker"],
  status: "experimental",
  frame: {
    height: "lg",
  },
  show: ["src/routes/index.tsx", "src/components/IosPickerItem.tsx", "src/styles.css"],
  test: [
    { attr: ["#carousel-ios-picker-loop-hours", "data-ready", "true"] },
    { matches: '#carousel-ios-picker-loop-hours-slide-0[style*="opacity: 1"]' },
    { matches: '#carousel-ios-picker-loop-hours-viewport > div[style*="rotateX"]' },
    { attr: ["#carousel-ios-picker-loop-minutes", "data-ready", "true"] },
    { attr: ["#carousel-ios-picker-loop-hours", "data-loop", "true"] },
    { matches: '#carousel-ios-picker-loop-hours-slide-23[style*="opacity: 1"]' },
  ],
});
