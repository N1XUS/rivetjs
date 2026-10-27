import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PressableFeedback: Disabled",
  summary: "isDisabled on the root turns off every layer.",
  tags: ["pressable-feedback"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ["#pf-disabled", "disabled", ""],
    },
  ],
});
