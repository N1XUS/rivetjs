import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Resizable: Demo",
  summary: "A horizontal group with a nested vertical group: drag or focus a handle and use the arrow keys to resize.",
  tags: ["resizable"],
  status: "experimental",
  frame: { height: 300, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#handle-one", "data-separator", "inactive"] },
    { press: ["#handle-one", "ArrowRight"] },
    { attr: ["#handle-one", "aria-valuenow", "55"] },
    { press: ["#handle-two", "ArrowDown"] },
    { attr: ["#handle-two", "aria-valuenow", "30"] },
  ],
});
