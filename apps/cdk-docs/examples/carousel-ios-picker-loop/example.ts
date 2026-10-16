import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "iOS style picker with loop",
  summary:
    "embla's IOS Style Picker Loop example: the same 3D wheels with loop, so hours and minutes wrap around; slides past the end are placed on the wheel.",
  tags: ["carousel", "picker", "css"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/components/IosPickerItem.tsx", "src/styles.css"],
  test: [
    { attr: ["#hours", "data-ready", "true"] },
    { matches: '#hours-slide-0[style*="opacity: 1"]' },
    { matches: '#hours-viewport > div[style*="rotateX"]' },
    { attr: ["#hours", "data-loop", "true"] },
    { matches: '#hours-slide-23[style*="opacity: 1"]' },
    { attr: ["#minutes", "data-ready", "true"] },
  ],
});
