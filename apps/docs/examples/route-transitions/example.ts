import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Route transitions",
  summary: "Pages fade on navigation, a thumbnail grows into the big photo, and a pending label shows while a slow page loads.",
  tags: ["routing", "transitions"],
  status: "experimental",
  mode: "server",
  show: ["src/routes/index.tsx", "src/routes/photos/[id].tsx", "src/routes/_layout.tsx", "src/styles.css", "vite.config.ts"],
});
