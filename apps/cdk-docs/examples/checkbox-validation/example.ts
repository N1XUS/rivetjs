import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Checkbox validation",
  summary: "A required CheckboxField with a description and a custom FieldError, a server error from Form validationErrors, and realtime aria validation.",
  tags: ["checkbox", "validation", "forms"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Native: `required` on the input; no error before a submit attempt.
    { attr: ["#terms", "required", ""] },
    { attr: ["#terms", "aria-invalid", null] },
    { described: ["#terms", "Read them first."] },
    { absent: "#terms-error" },
    // Server error (Form validationErrors, by name): shown from the first render.
    { attr: ["#news", "aria-invalid", "true"] },
    { described: ["#news", "This list is closed."] },
    // aria behaviour: realtime, aria-required instead of required.
    { attr: ["#adult", "aria-required", "true"] },
    { attr: ["#adult", "aria-invalid", "true"] },
    { expect: ["#adult-error", "Confirm your age."] },
    { matches: 'div[data-invalid="true"]:has(> label #adult)' },
    // A submit attempt: the browser blocks it and the required box shows its error.
    { click: "#submit" },
    { expect: ["#terms-error", "Accept the terms to continue."] },
    { attr: ["#terms", "aria-invalid", "true"] },
    { expect: ["#result", "not sent"] },
    { click: "label:has(#terms)" },
    { absent: "#terms-error" },
    { click: "label:has(#adult)" },
    { absent: "#adult-error" },
  ],
});
