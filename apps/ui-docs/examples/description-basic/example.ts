import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Description: Usage",
  summary: 'Description demo "Usage".',
  tags: ["description"],
  status: "experimental",
  frame: { height: 136 },
  show: ["src/routes/index.tsx"],
  test: [{ described: ["#email", "We'll never share your email"] }],
});
