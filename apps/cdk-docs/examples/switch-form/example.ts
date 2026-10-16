import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Switch in a form",
  summary: "A required SwitchField with a description and FieldError, and a Switch that submits name=value while on and nothing while off.",
  tags: ["switch", "forms", "validation"],
  status: "experimental",
  frame: { height: 194, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#sw-2fa", "required", ""] },
    { attr: ["#sw-2fa", "role", "switch"] },
    { described: ["#sw-2fa", "Your organisation requires two-factor authentication."] },
    { attr: ["#sw-dark", "name", "theme"] },
    // Submit while the required switch is off: blocked, the error shows.
    { click: "#sw-save" },
    { expect: ["#sw-result", "not saved"] },
    { attr: ["#sw-2fa", "aria-invalid", "true"] },
    { matches: "div:has(> label #sw-2fa) > .rv-FieldError" },
    { click: "label:has(#sw-2fa)" },
    { absent: ".rv-FieldError" },
    { click: "#sw-save" },
    { expect: ["#sw-result", "two-factor=on theme=null"] },
    { click: "label:has(#sw-dark)" },
    { click: "#sw-save" },
    { expect: ["#sw-result", "two-factor=on theme=dark"] },
  ],
});
