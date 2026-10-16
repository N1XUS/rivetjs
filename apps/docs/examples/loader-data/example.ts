import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Loader data",
  summary: "A server-only serverLoad function in the page file returns data; the page renders it and filters it in the browser.",
  tags: ["routing", "loaders"],
  frame: { height: 220, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#updated", "Updated 2026-10-01"] },
    { expect: ["#count", "Showing 3 of 3"] },
    { click: "#unread" },
    { expect: ["#count", "Showing 2 of 3"] },
  ],
});
