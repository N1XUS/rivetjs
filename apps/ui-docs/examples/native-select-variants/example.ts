import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NativeSelect: Variants",
  summary: "primary (bordered field, the default) and secondary (filled, no shadow) for use on surfaces.",
  tags: ["native-select"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".native-select--primary" }, { matches: ".native-select--secondary" }],
});
