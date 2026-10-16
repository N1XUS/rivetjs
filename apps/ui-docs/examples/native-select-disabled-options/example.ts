import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NativeSelect: With Disabled Options",
  summary: "disabled on an Option keeps it visible but not selectable.",
  tags: ["native-select"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "option[value=s1]:disabled" }, { matches: "option[value=s3]:checked" }],
});
