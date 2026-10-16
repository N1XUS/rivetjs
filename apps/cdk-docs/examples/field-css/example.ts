import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Field parts with plain CSS",
  summary: "A plain stylesheet for the default part classes rv-Label and rv-FieldError and the slot attribute of Text and FieldError.",
  tags: ["label", "field-error", "css", "styling"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { matches: "label.rv-Label#css-code-label" },
    { matches: "[slot='description']#css-code-description" },
    { matches: ".rv-FieldError[slot='errorMessage']#css-code-error" },
  ],
});
