import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FieldError messages",
  summary: "FieldError content: the validation errors by default, static content, or a function of the validation; hidden while the field is valid.",
  tags: ["field-error", "validation"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { absent: "#fe-default" },
    { click: "#fe-break" },
    { expect: ["#fe-default", "Too short. Needs a digit."] },
    { expect: ["#fe-static", "Check the password rules."] },
    { expect: ["#fe-fn", "2 problem(s): Too short. Needs a digit."] },
    { click: "#fe-fix" },
    { absent: "#fe-default" },
    { absent: "#fe-static" },
  ],
});
