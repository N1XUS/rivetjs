import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Clipboard: copyToClipboard()",
  summary: "The [cdkCopyToClipboard] behaviour: retry a refused copy up to `attempts` times, report once through `copied`, cancel with destroyCopyToClipboard.",
  tags: ["cdk", "clipboard", "options", "events"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#copy" },
    { expect: ["#log li:nth-child(1)", "copied"] },
    { click: "#cancel" },
    { expect: ["#log li:nth-child(2)", "retries cancelled"] },
    { click: "#copy" },
    { expect: ["#log li:nth-child(3)", "copied"] },
  ],
});
