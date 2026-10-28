import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBox: Virtualized",
  summary: "10,000 options with a server-rendered window and keyboard scrolling.",
  tags: ["list-box"],
  status: "experimental",
  frame: { height: 336 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: '[role=option][aria-setsize="10000"]' },
    { absent: '[role=option][data-key="9999"]' },
    { click: '[role=option][data-key="0"]' },
    { matches: '[role=option][data-key="0"][aria-selected=true]' },
    { key: "ArrowDown" },
    { focused: '[role=option][data-key="1"]' },
    { key: "End" },
    { focused: '[role=option][data-key="9999"]' },
    { key: "Space" },
    { matches: '[role=option][data-key="9999"][aria-selected=true]' },
    { key: "Home" },
    { focused: '[role=option][data-key="0"]' },
  ],
});
