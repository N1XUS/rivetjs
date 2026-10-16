import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Form validationBehavior",
  summary:
    "validationBehavior on a Form sets it for every field inside: native (constraint attributes, blocks submit) or aria (noValidate, aria-required, never blocks).",
  tags: ["form", "validation"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#native-form", "novalidate", null] },
    { attr: ["#native-email", "required", ""] },
    { attr: ["#native-email", "aria-required", null] },
    { attr: ["#aria-form", "novalidate", ""] },
    { attr: ["#aria-email", "required", null] },
    { attr: ["#aria-email", "aria-required", "true"] },
    // native: the empty required field blocks the submit, shows its error and takes focus.
    { click: "#native-submit" },
    { matches: "#native-email-error" },
    { focused: "#native-email" },
    // aria: the submit goes through although the field is empty.
    { click: "#aria-submit" },
    { expect: ["#fv-log", "aria form submitted"] },
  ],
});
