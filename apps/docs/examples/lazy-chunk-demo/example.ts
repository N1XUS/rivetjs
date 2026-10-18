import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Code per page",
  summary: "Two components, one small code file for the page. The browser fetches it only when you are about to use a button.",
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
