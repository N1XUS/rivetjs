import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Optimistic like",
  summary: "The like count changes at once; the server is told in the background, and the change is undone if it fails.",
  tags: ["signals", "events", "actions", "forms"],
  mode: "server",
  show: ["src/routes/index.tsx"],
});
