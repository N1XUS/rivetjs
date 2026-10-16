import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FileTrigger with a Link or a custom pressable",
  summary: "Any pressable child works: a Link, or your own element through <Pressable> (render-function child spreading the press props).",
  tags: ["file-trigger", "pressable"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#attach", "role", "link"] },
    { attr: ["#drop-target", "role", "button"] },
    { attr: ["[data-testid=via-link]", "type", "file"] },
    { attr: ["[data-testid=via-pressable]", "type", "file"] },
  ],
});
