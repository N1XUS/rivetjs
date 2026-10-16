import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NativeSelect: Disabled Select",
  summary: "isDisabled disables the select and dims the field.",
  tags: ["native-select"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["select", "disabled", ""] }, { attr: ["select", "data-disabled", "true"] }],
});
