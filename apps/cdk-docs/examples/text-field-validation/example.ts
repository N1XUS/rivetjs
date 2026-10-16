import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextField validation",
  summary: "TextField validation: isRequired + type email (native) with a FieldError render function, a validate function, Form server errors, aria behaviour.",
  tags: ["text-field", "validation", "forms"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Native: constraint attributes on the input; errors show after submit / commit.
    { attr: ["#email", "required", ""] },
    { attr: ["#email", "aria-invalid", null] },
    { absent: "#email-error" },
    // Server error by name: shown until the field is edited.
    { attr: ["#user", "aria-invalid", "true"] },
    { described: ["#user", "That username is taken."] },
    { matches: "div[data-invalid]:has(> #user)" },
    // aria: realtime, aria-required, the validate result as the message.
    { attr: ["#code", "aria-required", "true"] },
    { attr: ["#code", "aria-invalid", "true"] },
    { expect: ["#code-error", "At least 3 characters (you typed 2)."] },
    // A validate result blocks native submit through the input's custom validity.
    { attr: ["#nick", "data-rv-error", "No spaces."] },
    // Submit: the empty required email shows its custom message and takes focus.
    { click: "#signup" },
    { expect: ["#email-error", "Enter your email."] },
    { focused: "#email" },
  ],
});
