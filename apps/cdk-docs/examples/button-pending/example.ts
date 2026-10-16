import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Pending Button",
  summary:
    "A submit Button with isPending (a signal) and a ProgressBar shown from the isPending render prop: while pending it ignores presses, stops submitting and stays focusable.",
  tags: ["button", "pending", "forms"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#send", "type", "submit"] },
    { absent: "#send-progress" },
    { click: "#send" },
    { expect: ["#status", "Sent 1 time(s)"] },
    { attr: ["#send", "data-pending", "true"] },
    { attr: ["#send", "aria-disabled", "true"] },
    // A pending submit button renders type="button": Enter neither presses nor submits.
    { attr: ["#send", "type", "button"] },
    { attr: ["#send-progress", "role", "progressbar"] },
    { press: ["#send", "Enter"] },
    { focused: "#send" },
    { click: "#done" },
    { attr: ["#send", "data-pending", null] },
    { attr: ["#send", "type", "submit"] },
    { expect: ["#status", "Sent 1 time(s), idle"] },
  ],
});
