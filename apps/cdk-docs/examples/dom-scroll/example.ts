import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DOM helpers",
  summary:
    "scrollIntoView scrolls one container (not the page) to show an item; scroll parents, containment, focus and viewport helpers from @rivetjs/cdk/dom.",
  tags: ["cdk", "dom", "basic"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#go" },
    { expect: ["#report li:nth-child(1)", "item 25 visible: true"] },
    { expect: ["#report li:nth-child(2)", "isScrollable(list): true"] },
    { expect: ["#report li:nth-child(3)", "#list"] },
    { expect: ["#report li:nth-child(4)", "true"] },
    { expect: ["#report li:nth-child(5)", "#go"] },
    { expect: ["#report li:nth-child(6)", "false"] },
    { expect: ["#report li:nth-child(7)", "true"] },
  ],
});
