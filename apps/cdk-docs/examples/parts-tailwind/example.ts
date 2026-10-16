import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Parts with Tailwind",
  summary: "Heading, Separator, Keyboard and Input styled with Tailwind utilities and the cdk state variants (focused:, hovered:, focus-visible:).",
  tags: ["heading", "separator", "keyboard", "input", "tailwind"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ matches: "#tw-heading.rv-Heading" }, { press: ["#tw-input", "Tab"] }, { click: "#tw-input" }, { attr: ["#tw-input", "data-focused", "true"] }],
});
