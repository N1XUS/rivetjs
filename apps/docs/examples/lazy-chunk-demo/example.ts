import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Code per page",
  summary: "Two components, one small code file each. The browser fetches them after the page loads, at low priority, and runs one only when you use its button.",
  tags: ["resume", "chunks", "loading"],
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/components/LikeButton.tsx", "src/components/MoreInfo.tsx"],
  test: [
    { expect: ["#like", "Like (0)"] },
    { click: "#like" },
    { expect: ["#like", "Like (1)"] },
    { click: "#more" },
    { expect: ["#details", "Science fiction"] },
  ],
});
