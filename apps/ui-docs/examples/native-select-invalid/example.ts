import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NativeSelect: Invalid State",
  summary: "isInvalid (or a validate result) shows the error ring and the FieldError instead of the description.",
  tags: ["native-select"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["select", "aria-invalid", "true"] }, { described: ["select", "one workspace"] }],
});
