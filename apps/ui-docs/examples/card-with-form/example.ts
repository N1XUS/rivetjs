import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Card: With Form",
  summary: 'Card demo "With Form".',
  tags: ["card"],
  status: "experimental",
  frame: { height: 364 },
  show: ["src/routes/index.tsx"],
  test: [{ fill: ["input[type=email]", "ada@example.com"] }, { matches: "button[type=submit]" }],
});
