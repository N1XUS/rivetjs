import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextField: Shorthand",
  summary: "Rivet addition: `label`, `description`, `errorMessage` and `placeholder` props instead of the Label / Input / Description / FieldError parts.",
  tags: ["textfield"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ described: ["input", "We never share it"] }],
});
