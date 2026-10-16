import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Navbar: Hide on Scroll",
  summary: "hideOnScroll: scroll down and the bar slides away, scroll up and it comes back (CSS scroll-state, no JavaScript).",
  tags: ["navbar"],
  status: "experimental",
  frame: { height: 961, auto: true, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "nav[data-hide-on-scroll=true]" }, { wheel: ["main", 600] }],
});
