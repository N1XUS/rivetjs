import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FileTrigger options",
  summary: "acceptedFileTypes (accept), allowsMultiple (multiple), defaultCamera (capture) and acceptDirectory (webkitdirectory) set the hidden input.",
  tags: ["file-trigger", "options"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["[data-testid=images]", "accept", "image/png,image/jpeg"] },
    { attr: ["[data-testid=images]", "multiple", ""] },
    { attr: ["[data-testid=selfie]", "capture", "user"] },
    { attr: ["[data-testid=selfie]", "multiple", null] },
    { attr: ["[data-testid=folder]", "webkitdirectory", ""] },
  ],
});
