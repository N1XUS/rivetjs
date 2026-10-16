import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PreviewTrigger with a custom trigger",
  summary:
    "A span with role=link wrapped in <Focusable>: it becomes focusable (tabindex 0), gets the trigger handlers and ARIA, and opens the preview on keyboard focus.",
  tags: ["preview-trigger", "focusable"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#ptc-trigger", "tabindex", "0"] },
    { attr: ["#ptc-trigger", "aria-haspopup", "dialog"] },
    { key: "Tab" },
    { focused: "#ptc-trigger" },
    { matches: "#ptc-preview[role=dialog]" },
    { attr: ["#ptc-trigger", "aria-expanded", "true"] },
    { key: "Escape" },
    { absent: "#ptc-preview" },
    { focused: "#ptc-trigger" },
  ],
});
