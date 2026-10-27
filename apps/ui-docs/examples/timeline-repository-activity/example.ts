import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Timeline: Repository Activity",
  summary: "Commits, reviews and merges with icon markers and inline code in the content.",
  tags: ["timeline"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#timeline-repo", "merged into main"],
    },
  ],
});
