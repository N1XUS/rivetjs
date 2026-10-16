import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SearchField: description, validation and disabled",
  summary: "A description `Text` slot, `isRequired` with a `FieldError` shown on submit, `minLength` on the input, and a disabled field.",
  tags: ["search-field", "forms", "validation"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#q", "required", ""] },
    { described: ["#q", "At least 2 characters."] },
    { click: "#go" },
    { attr: ["#q", "aria-invalid", "true"] },
    { matches: "div[data-invalid]:has(> div > #q)" },
    { matches: "#q-error" },
    { focused: "#q" },
    { attr: ["#off", "disabled", ""] },
    { matches: "div[data-disabled]:has(#off)" },
  ],
});
