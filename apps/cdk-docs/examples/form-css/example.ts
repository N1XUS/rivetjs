import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Form with plain CSS",
  summary:
    "A plain stylesheet for a Form: the rv-Form class, fields inside it by their default classes and [data-invalid], and :user-invalid on native inputs.",
  tags: ["form", "css", "styling"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { matches: "form.rv-Form#css-form" },
    { matches: "#css-form .rv-TextField[data-invalid] > .rv-Input#css-zip" },
    { expect: ["#css-zip-error.rv-FieldError", "Unknown postcode."] },
    { fill: ["#css-city", "Paris"] },
    // Editing a field clears its server error on commit (blur after a change).
    { fill: ["#css-zip", "75001"] },
    { key: "Tab" },
    { attr: ["#css-zip", "aria-invalid", null] },
    { absent: "#css-zip-error" },
  ],
});
