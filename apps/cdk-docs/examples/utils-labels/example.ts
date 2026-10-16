import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "useLabels() and useDescription()",
  summary: "useLabels combines aria-label and aria-labelledby or falls back to a default label; useDescription adds a shared hidden description.",
  tags: ["cdk", "utils", "a11y"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#delete", "aria-labelledby", "delete row-title"] },
    { attr: ["#close", "aria-label", "Close"] },
    { described: ["#help", "Opens the keyboard shortcut list"] },
  ],
});
