import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Button: Outline Variant",
  summary: 'Button demo "Outline Variant": the outline variant on a Button and on a ButtonGroup.',
  tags: ["button", "button-group"],
  status: "experimental",
  frame: { height: 200, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".button--outline" }, { matches: ".button-group .button--outline" }],
});
