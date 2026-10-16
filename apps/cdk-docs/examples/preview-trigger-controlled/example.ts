import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Controlled PreviewTrigger",
  summary: "isOpen as a two-way signal: buttons write it, keyboard focus and Escape write it back and call onOpenChange.",
  tags: ["preview-trigger", "signals"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#ptk-show" },
    { matches: "#ptk-preview[role=dialog]" },
    { attr: ["#ptk-link", "aria-expanded", "true"] },
    { expect: ["#ptk-state", "open=true"] },
    { click: "#ptk-hide" },
    { absent: "#ptk-preview" },
    { expect: ["#ptk-state", "open=false"] },
    // Keyboard focus on the link opens it after the delay and writes the signal.
    { press: ["#ptk-hide", "Tab"] },
    { focused: "#ptk-link" },
    { matches: "#ptk-preview" },
    { expect: ["#ptk-state", "open=true"] },
    { expect: ["#ptk-log", "open"] },
    { key: "Escape" },
    { absent: "#ptk-preview" },
    { expect: ["#ptk-state", "open=false"] },
    { expect: ["#ptk-log", "open close"] },
  ],
});
