import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Clipboard: copy()",
  summary: "copy(text) from @rivetjs/cdk/clipboard, with a status message in a role=status region.",
  tags: ["cdk", "clipboard", "basic"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["#status", "role", "status"] }, { press: ["#copy", "Enter"] }, { expect: ["#status", "Copied"] }],
});
