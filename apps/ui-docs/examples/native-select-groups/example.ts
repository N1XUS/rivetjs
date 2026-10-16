import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NativeSelect: With Groups",
  summary: "NativeSelect.OptGroup groups options under a label.",
  tags: ["native-select"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "optgroup[label=Americas] option[value=austin]" }],
});
