import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Resizable: Nested groups",
  summary: "A vertical group inside a horizontal one: an editor layout with an explorer, the code and a terminal. Each group needs its own `id`.",
  tags: ["resizable"],
  status: "experimental",
  frame: { height: 380, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#terminal-handle", "aria-orientation", "horizontal"] },
    { press: ["#explorer-handle", "ArrowRight"] },
    { attr: ["#explorer-handle", "aria-valuenow", "30"] },
    { press: ["#terminal-handle", "ArrowUp"] },
    { attr: ["#terminal-handle", "aria-valuenow", "60"] },
  ],
});
