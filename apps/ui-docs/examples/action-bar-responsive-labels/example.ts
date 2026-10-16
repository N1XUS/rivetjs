import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ActionBar: Responsive Labels",
  summary:
    "Button text in .action-bar__label is visible on wide screens and screen-reader-only below 640px (icon-only buttons on phones); the bar here acts on a Table selection.",
  tags: ["action-bar"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "tbody tr:nth-child(3) label" }, { matches: ".action-bar[data-open=true]" }, { expect: ["[data-slot=action-bar-prefix]", "1 selected"] }],
});
