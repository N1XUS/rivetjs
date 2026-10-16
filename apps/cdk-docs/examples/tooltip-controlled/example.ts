import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Controlled tooltips",
  summary:
    "isOpen as a two-way signal on a TooltipTrigger with onOpenChange, and a standalone Tooltip positioned against a span through triggerRef, opened by a signal.",
  tags: ["tooltip", "signals"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { absent: "#tc-trigger-tip" },
    // Keyboard focus writes the signal (two-way) and calls onOpenChange.
    { key: "Tab" },
    { matches: "#tc-trigger-tip" },
    { expect: ["#tc-state", "trigger=open"] },
    { expect: ["#tc-log", "open"] },
    { key: "Escape" },
    { absent: "#tc-trigger-tip" },
    { expect: ["#tc-state", "trigger=closed"] },
    { expect: ["#tc-log", "open close"] },
    // Writing the signal opens and closes it.
    { click: "#tc-show" },
    { matches: "#tc-trigger-tip" },
    { expect: ["#tc-state", "trigger=open"] },
    { click: "#tc-hide" },
    { absent: "#tc-trigger-tip" },
    { expect: ["#tc-state", "trigger=closed"] },
    // Standalone: triggerRef + isOpen.
    { click: "#tc-toggle-standalone" },
    { matches: "#tc-standalone[role=tooltip]" },
    { attr: ["#tc-standalone", "data-placement", "bottom"] },
    { described: ["#tc-anchor", "Shown on request"] },
    { click: "#tc-toggle-standalone" },
    { absent: "#tc-standalone" },
  ],
});
