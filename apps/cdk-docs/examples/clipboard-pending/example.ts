import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Clipboard: copyText() and beginCopy()",
  summary: "Synchronous copies through a hidden textarea: copyText for short strings, beginCopy / PendingCopy for large ones.",
  tags: ["cdk", "clipboard", "options"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#result", "Nothing copied yet"] },
    { click: "#short" },
    { expect: ["#result", "copyText: copied 2 characters"] },
    { click: "#long" },
    { expect: ["#result", "beginCopy: copied"] },
    { absent: "textarea" },
  ],
});
