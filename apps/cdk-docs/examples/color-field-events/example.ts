import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorField events, states and render props",
  summary: "onChange and onFocusChange logged; read-only, disabled and required fields; a class render prop reading isInvalid while the text does not parse.",
  tags: ["color-field", "events", "render-props", "tailwind"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { fill: ["#ev-field input", "#00f"] },
    { press: ["#ev-field input", "Enter"] },
    { expect: ["#ev-change", "change #0000FF"] },
    { expect: ["#ev-focus", "focused true"] },
    { attr: ["#ro-field input", "readonly", ""] },
    { attr: ["#off-field input", "disabled", ""] },
    { attr: ["#req-field input", "required", ""] },
    { attr: ["#ev-field [data-channel]", "data-channel", "hex"] },
  ],
});
