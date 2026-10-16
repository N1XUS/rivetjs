import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Effect: page title",
  summary: "A clientEffect keeps the browser tab title in sync with a signal. It runs only in the browser.",
  tags: ["effects", "signals"],
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#seen", "Tab title: 0 unread"] },
    { click: "#more" },
    { expect: ["#seen", "Tab title: 1 unread"] },
    { click: "#more" },
    { expect: ["#seen", "Tab title: 2 unread"] },
  ],
});
