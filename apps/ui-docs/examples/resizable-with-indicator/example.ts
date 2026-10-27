import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Resizable: With indicator",
  summary: "`withIndicator` puts the drag dots on a line handle; compose `ResizableIndicator` inside a handle for a pill or custom content.",
  tags: ["resizable"],
  status: "experimental",
  frame: { height: 340, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#files-handle [data-slot=resizable-indicator][data-type=drag] svg" },
    { matches: "#console-handle [data-slot=resizable-indicator][data-type=pill]" },
    { press: ["#console-handle", "ArrowUp"] },
    { attr: ["#console-handle", "aria-valuenow", "45"] },
  ],
});
