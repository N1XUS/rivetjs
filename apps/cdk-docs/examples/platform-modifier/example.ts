import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Command modifier and virtual clicks",
  summary: "isCtrlKeyPressed picks Meta on Apple platforms and Control elsewhere; isVirtualClick tells keyboard and screen reader clicks from pointer clicks.",
  tags: ["cdk", "platform", "events"],
  status: "experimental",
  frame: { height: 218, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["#note", "ControlOrMeta+s"] },
    { expect: ["#status", "Saved with"] },
    { click: "#target" },
    { expect: ["#click", "Pointer click"] },
    { press: ["#target", "Enter"] },
    { expect: ["#click", "Virtual click"] },
  ],
});
