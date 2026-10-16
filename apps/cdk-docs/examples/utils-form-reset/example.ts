import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "useFormReset()",
  summary: "Keep a signal in step with a native form reset: useFormReset calls onReset with the initial value when the field's form resets.",
  tags: ["cdk", "utils", "events", "forms"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { fill: ["#name", "Grace"] },
    { expect: ["#preview", "Hello, Grace!"] },
    { click: "#reset" },
    { expect: ["#preview", "Hello, Ada!"] },
    { expect: ["#resets", "Resets: 1"] },
  ],
});
