import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NativeSelect: With Label",
  summary: "Label points at the select (for / id); without a visible label pass aria-label.",
  tags: ["native-select"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ name: ["select", "Units"] }, { name: ["[aria-label='Rows per page']", "Rows per page"] }],
});
