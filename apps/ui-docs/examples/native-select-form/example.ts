import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NativeSelect: Form Example",
  summary: "Inside a Form: name + isRequired submit with the form; native validation shows the FieldError.",
  tags: ["native-select"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button[type=submit]" }, { attr: ["select[name=size]", "aria-invalid", "true"] }, { expect: ["#sent", "nothing yet"] }],
});
