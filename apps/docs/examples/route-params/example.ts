import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Route params",
  summary: "Brackets in file names become URL parameters: [id] for one segment, [...path] for the rest of the URL.",
  tags: ["routing", "params"],
  mode: "server",
  show: ["src/routes/items/[id].tsx", "src/routes/docs/[...path].tsx", "src/routes/index.tsx"],
});
