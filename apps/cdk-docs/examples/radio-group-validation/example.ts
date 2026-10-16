import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioGroup validation",
  summary: "A required RadioGroup (native required on every radio), a server error from Form validationErrors, and realtime aria validation with validate.",
  tags: ["radio-group", "validation", "forms"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#plan", "aria-required", "true"] },
    { attr: ["#plan input[value='free']", "required", ""] },
    // FieldError renders nothing while the group is valid.
    { absent: "#plan-error" },
    { attr: ["#seat", "aria-invalid", "true"] },
    { described: ["#seat", "Seat 1A was just taken."] },
    { attr: ["#seat input[value='1a']", "data-rv-error", "Seat 1A was just taken."] },
    { attr: ["#meal", "aria-invalid", "true"] },
    { expect: ["#meal-error", "Fish is sold out."] },
  ],
});
