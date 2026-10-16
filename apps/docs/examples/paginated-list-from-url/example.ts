import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Paginated list from the URL",
  summary: "The page number lives in the URL (?page=2); the loader reads it and returns only that page's rows.",
  tags: ["routing", "loaders", "links"],
  mode: "server",
  show: ["src/routes/index.tsx"],
});
