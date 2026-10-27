import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FloatingToc: In Page Context",
  summary: "Track the section in view with an IntersectionObserver and scroll to a section on item press.",
  tags: ["floating-toc"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [],
});
