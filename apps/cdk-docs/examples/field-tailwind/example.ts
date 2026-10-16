import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Field parts with Tailwind",
  summary: "Label, Text and FieldError styled with Tailwind: class props on each part and peer / aria-invalid: variants on a custom field.",
  tags: ["label", "field-error", "tailwind", "styling"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#tw-age-label.font-medium" },
    { absent: "#tw-age-error" },
    { fill: ["#tw-age", "12"] },
    { expect: ["#tw-age-error", "You must be 18 or older."] },
    { fill: ["#tw-age", "30"] },
    { absent: "#tw-age-error" },
  ],
});
