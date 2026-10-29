import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FloatingToc: Virtualized",
  summary: "400 sections: the trigger shows a window of bars around the active one and the list is a virtualized ListBox.",
  tags: ["floating-toc"],
  status: "experimental",
  frame: { height: 400 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#toc-virtual" },
    { matches: '[role=option][aria-setsize="400"]' },
    { absent: '[role=option][data-key="v1.0.0"]' },
    { focused: '[role=option][data-key="v4.9.9"]' },
    { key: "End" },
    { focused: '[role=option][data-key="v1.0.0"]' },
    { key: "Enter" },
    { absent: "[role=listbox]" },
    { expect: ["#toc-virtual-heading", "Version 1.0.0"] },
    { attr: ["#toc-virtual [data-slot=floating-toc-bar]:last-child", "data-active", "true"] },
  ],
});
