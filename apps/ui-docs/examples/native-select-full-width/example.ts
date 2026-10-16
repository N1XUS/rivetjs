import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NativeSelect: Full Width",
  summary: "fullWidth stretches the field and the select to the container.",
  tags: ["native-select"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".native-select--full-width .native-select__trigger--full-width" }],
});
