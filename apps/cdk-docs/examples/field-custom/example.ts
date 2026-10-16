import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Custom field from Label, Text and FieldError",
  summary:
    "A field built from the parts: fieldAria for the ids, Label, a native input, Text as the description and FieldError shown while the value is invalid.",
  tags: ["label", "field-error", "text", "forms"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#slug-label", "for", "slug"] },
    { name: ["#slug", "Slug"] },
    { described: ["#slug", "Used in the page URL."] },
    { absent: "#slug-error" },
    { fill: ["#slug", "Hello World"] },
    { attr: ["#slug", "aria-invalid", "true"] },
    { expect: ["#slug-error", "Lowercase letters and dashes only."] },
    { described: ["#slug", "Used in the page URL. Lowercase letters and dashes only."] },
    { fill: ["#slug", "hello-world"] },
    { absent: "#slug-error" },
  ],
});
