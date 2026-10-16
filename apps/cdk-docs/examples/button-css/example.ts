import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Button with plain CSS",
  summary: "Buttons styled by a plain stylesheet: the default rv-Button class, [data-pressed], [data-pending], :disabled and :focus-visible.",
  tags: ["button", "css", "styling"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { matches: "#css-save.rv-Button" },
    { matches: "#css-delete.rv-Button.danger" },
    { click: "#css-save" },
    { attr: ["#css-save", "data-pending", "true"] },
    { expect: ["#css-status", "saving"] },
  ],
});
