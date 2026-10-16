import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextField: With Description",
  summary: 'TextField demo "With Description".',
  tags: ["textfield"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ described: ["input", "Choose a unique username"] }],
});
