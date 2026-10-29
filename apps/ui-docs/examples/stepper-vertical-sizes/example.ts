import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: Vertical Sizes",
  summary: 'size="sm" | "md" | "lg" on vertical steppers: indicator size, gaps and text scale together.',
  tags: ["stepper", "navigation"],
  status: "experimental",
  frame: {
    height: "md",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#stepper-vertical-size-sm.stepper--sm.stepper--vertical",
    },
    {
      matches: "#stepper-vertical-size-lg.stepper--lg.stepper--vertical",
    },
  ],
});
