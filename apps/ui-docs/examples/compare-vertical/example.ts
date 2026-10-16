import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Compare: Vertical",
  summary: 'orientation="vertical": the divider runs across the frame and the after layer is revealed from the top; ArrowDown / PageDown move it down.',
  tags: ["compare", "image", "orientation"],
  status: "experimental",
  frame: { height: 460 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#compare-vertical-handle", "aria-orientation", "vertical"] },
    { attr: ["#compare-vertical-handle", "aria-valuenow", "40"] },
    { press: ["#compare-vertical-handle", "ArrowDown"] },
    { attr: ["#compare-vertical-handle", "aria-valuenow", "41"] },
    { press: ["#compare-vertical-handle", "PageUp"] },
    { attr: ["#compare-vertical-handle", "aria-valuenow", "31"] },
  ],
});
