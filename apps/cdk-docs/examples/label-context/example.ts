import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Label and Input contexts",
  summary:
    "A custom field wires Label, Input and Text through LabelContext, InputContext and TextContext with fieldProps ids; the invalid state is an accessor.",
  tags: ["label", "input", "context", "field"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { name: ["#lc-input", "Email"] },
    { described: ["#lc-input", "Work address"] },
    { fill: ["#lc-input", "nope"] },
    { attr: ["#lc-input", "data-invalid", "true"] },
    { fill: ["#lc-input", "a@b.co"] },
    { attr: ["#lc-input", "data-invalid", null] },
  ],
});
