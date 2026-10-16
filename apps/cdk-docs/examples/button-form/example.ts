import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Buttons in a form",
  summary: "Submit buttons with name and value, formNoValidate, a reset button and a submit button outside the form (form attribute).",
  tags: ["button", "forms"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#publish", "type", "submit"] },
    { attr: ["#publish", "name", "intent"] },
    { attr: ["#outside", "form", "post"] },
    // formNoValidate submits although the required title is empty.
    { click: "#draft" },
    { expect: ["#result", "intent=draft title="] },
    { fill: ["#title", "Hello"] },
    { click: "#publish" },
    { expect: ["#result", "intent=publish title=Hello"] },
    { click: "#outside" },
    { expect: ["#result", "intent=outside title=Hello"] },
    { click: "#clear" },
    { expect: ["#result", "reset"] },
  ],
});
