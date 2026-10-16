import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NativeSelect: Usage",
  summary: "A styled native select with a label; the platform draws the option list (mobile pickers, keyboard, autofill).",
  tags: ["native-select"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ name: ["select", "Tea"] }, { matches: "option[value=oolong]:checked" }],
});
