import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Separator: With Label",
  summary: "A labelled divider between a sign-in button and the alternatives: children turn the separator into two lines around the label.",
  tags: ["separator"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["#or-separator .separator-label__content", "or"] }, { attr: ["#or-separator .separator-label__line:first-child", "aria-hidden", "true"] }],
});
