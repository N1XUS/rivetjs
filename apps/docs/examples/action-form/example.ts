import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Action form",
  summary: "A plain HTML form posts to a server action, which saves the message and redirects back to the page.",
  tags: ["routing", "actions", "forms"],
  mode: "server",
  show: ["src/routes/index.tsx"],
});
