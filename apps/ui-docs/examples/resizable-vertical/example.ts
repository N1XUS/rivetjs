import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Resizable: Vertical",
  summary: "A vertical group: the handle is horizontal and resizes with ArrowUp / ArrowDown.",
  tags: ["resizable"],
  status: "experimental",
  frame: { height: 300, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["#handle", "aria-orientation", "horizontal"] }, { press: ["#handle", "ArrowDown"] }, { attr: ["#handle", "aria-valuenow", "30"] }],
});
