import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxGroup validation",
  summary: "A required CheckboxGroup, a required checkbox in a group, a server error from Form validationErrors, and realtime aria validation with validate.",
  tags: ["checkbox-group", "validation", "forms"],
  status: "experimental",
  frame: { height: "xl" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Native required: every enabled box is `required` while none is checked.
    { attr: ["#langs input[value='en']", "required", ""] },
    { attr: ["#langs", "data-required", "true"] },
    { absent: "#langs .rv-FieldError" },
    // Server error by name.
    { attr: ["#regions", "data-invalid", "true"] },
    { described: ["#regions", "No stock in these regions."] },
    // aria: realtime, validate gets the checked values.
    { attr: ["#extras", "data-invalid", "true"] },
    { expect: ["#extras .rv-FieldError", "Pick at most one."] },
    { attr: ["#extras input[value='gift']", "aria-invalid", "true"] },
    // Submit: blocked, the required group and the required checkbox show their errors.
    { click: "#order" },
    { expect: ["#langs .rv-FieldError", "Pick at least one language."] },
    // A checkbox's own isRequired: native `required` on that box only; the blocked submit marks its group invalid.
    { attr: ["#agree input[value='terms']", "required", ""] },
    { attr: ["#agree input[value='news']", "required", null] },
    { attr: ["#agree", "data-invalid", "true"] },
    { expect: ["#result", "not sent"] },
    { click: "#langs label:has(input[value='de'])" },
    { absent: "#langs .rv-FieldError" },
    { attr: ["#langs input[value='en']", "required", null] },
    { click: "#extras label:has(input[value='card'])" },
    { absent: "#extras .rv-FieldError" },
  ],
});
