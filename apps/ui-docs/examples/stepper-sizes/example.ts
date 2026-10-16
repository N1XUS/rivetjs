import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: Sizes",
  summary: "size sm, md (default) and lg scale the indicators and the text.",
  tags: ["stepper", "navigation"],
  status: "experimental",
  frame: {
    height: "md",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#stepper-size-sm.stepper--sm",
    },
    {
      matches: "#stepper-size-lg.stepper--lg",
    },
  ],
});
