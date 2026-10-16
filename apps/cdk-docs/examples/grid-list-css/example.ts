import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "GridList with plain CSS",
  summary:
    "No Tailwind: a stylesheet over rv-GridList, rv-GridListItem and rv-GridListHeader with [data-selected], [data-focus-visible], [data-disabled] and the description slot.",
  tags: ["grid-list", "css", "styling"],
  status: "experimental",
  frame: { height: 208, auto: true },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { matches: "#plans.rv-GridList" },
    { matches: "#plans .rv-GridListSection .rv-GridListHeader" },
    { matches: "#plans-free.rv-GridListItem[data-selected]" },
    { expect: ["#plans-pro [slot=description]", "Unlimited projects"] },
    { attr: ["#plans-team", "data-disabled", "true"] },
    { press: ["#plans-free", "ArrowDown"] },
    { attr: ["#plans-pro", "data-focus-visible", "true"] },
    { key: "Space" },
    { attr: ["#plans-pro", "aria-selected", "true"] },
    { attr: ["#plans-free", "aria-selected", "false"] },
  ],
});
