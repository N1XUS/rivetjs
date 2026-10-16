import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextArea with plain CSS",
  summary: "A plain stylesheet for a TextField with a TextArea part: rv-TextField, rv-Label, rv-TextArea and its data attributes, rv-Text, rv-FieldError.",
  tags: ["text-area", "css", "styling"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { matches: ".rv-TextField > .rv-Label + textarea.rv-TextArea#css-ta" },
    { described: ["#css-ta", "Plain text only."] },
    { matches: ".rv-TextField[data-invalid] > textarea.rv-TextArea[data-invalid]#css-ta-bad" },
    { expect: ["#css-ta-bad-error.rv-FieldError", "Too many lines."] },
    { fill: ["#css-ta", "Hi"] },
    { matches: "#css-ta[data-focused]" },
  ],
});
