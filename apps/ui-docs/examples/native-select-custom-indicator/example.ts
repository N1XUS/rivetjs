import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NativeSelect: Custom Indicator",
  summary: "indicator takes any content: a lucide ChevronsUpDown here; indicator={null} hides it.",
  tags: ["native-select"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=native-select-indicator] svg" }],
});
