import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextField with Tailwind",
  summary:
    "Each part of a TextField (Label, Input, Text, FieldError) styled with Tailwind: group-data-[disabled]: on the root, data-[invalid]: and focused: on the Input.",
  tags: ["text-field", "tailwind", "styling"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#tw-email.rounded-md" },
    { matches: "#tw-email-label.font-medium" },
    { attr: ["#tw-bad", "aria-invalid", "true"] },
    { matches: "#tw-bad[data-invalid]" },
    { expect: ["#tw-bad-error", "Not a valid code."] },
    { fill: ["#tw-email", "ada@example.com"] },
    { matches: "#tw-email[data-focused]" },
  ],
});
