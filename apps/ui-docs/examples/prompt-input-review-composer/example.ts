import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PromptInput: Review composer",
  summary: "A compact review surface: the pull request in the toolbar, a commit option, Approve next to Send, and follow-up requests from the composer.",
  tags: ["prompt-input", "ai"],
  status: "experimental",
  frame: { height: 300, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { fill: ["#review-text", "Rename the helper to formatPrice"] },
    { press: ["#review-text", "Enter"] },
    { expect: ["#review-log", "Follow-up requested: Rename the helper to formatPrice (then commit)"] },
    { click: "#review-approve" },
    { expect: ["#review-log", "Approved #482"] },
  ],
});
