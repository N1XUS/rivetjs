import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Live updates",
  summary: "A number that the server pushes to the page every two seconds with Server-Sent Events.",
  tags: ["client-effect", "endpoints", "streaming"],
  mode: "server",
  show: ["src/routes/index.tsx", "src/routes/events.ts"],
});
