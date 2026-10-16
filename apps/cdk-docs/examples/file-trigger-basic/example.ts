import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FileTrigger with a Button",
  summary: "A Button inside FileTrigger opens the file picker; onSelect receives the FileList (shown as a list of names).",
  tags: ["file-trigger"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["[data-testid=photos]", "type", "file"] },
    { attr: ["[data-testid=photos]", "style", "display:none"] },
    { expect: ["#picked", "No file selected"] },
    { name: ["#pick", "Select a file"] },
  ],
});
