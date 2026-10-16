import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextField with plain CSS",
  summary:
    "A plain stylesheet for the default classes of a TextField: rv-TextField, rv-Label, rv-Input, rv-Text, rv-FieldError and the root's data attributes.",
  tags: ["text-field", "css", "styling"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { matches: ".rv-TextField > .rv-Label + .rv-Input#css-name" },
    { described: ["#css-name", "First and last name."] },
    { matches: ".rv-TextField[data-invalid] > .rv-Input[data-invalid]#css-zip" },
    { expect: ["#css-zip-error.rv-FieldError", "Enter 5 digits."] },
    { matches: ".rv-TextField[data-readonly]:has(#css-ro)" },
    { fill: ["#css-name", "Ada"] },
    { matches: "#css-name[data-focused]" },
  ],
});
