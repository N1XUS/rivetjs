import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "JSON endpoint",
  summary: "Plain .ts route files export onGet and onPost and return a Response; the page calls them with fetch.",
  tags: ["routing", "endpoints", "api"],
  mode: "server",
  show: ["src/routes/api/notes.ts", "src/routes/api/notes/[id].ts", "src/routes/index.tsx"],
});
