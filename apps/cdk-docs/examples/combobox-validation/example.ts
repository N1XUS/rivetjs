import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ComboBox: validation",
  summary: "`isRequired` with a `<FieldError>`; `allowsCustomValue` keeps free text and submits it.",
  tags: ["combobox", "forms", "validation"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#city", "required", ""] },
    { click: "#submit" },
    { attr: ["#city", "aria-invalid", "true"] },
    { matches: ".rv-ComboBox[data-invalid]:has(#city)" },
    { described: ["#city", "Please fill out this field."] },
    { fill: ["#free", "Oslo"] },
    { attr: ["#free", "name", "free"] },
  ],
});
