import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Not found page",
  summary: "A _404.tsx file renders for URLs that match no route and for loaders that throw notFound().",
  tags: ["routing", "errors"],
  mode: "server",
  show: ["src/routes/_404.tsx", "src/routes/items/[id].tsx", "src/routes/index.tsx"],
});
