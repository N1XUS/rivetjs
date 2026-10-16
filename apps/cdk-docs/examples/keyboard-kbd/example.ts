import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Keyboard (kbd)",
  summary: "Keyboard renders a kbd with dir=ltr; a KeyboardContext slot styles every shortcut inside a list.",
  tags: ["keyboard", "shortcut", "context"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ attr: ["#kbd-copy", "dir", "ltr"] }, { matches: "#kbd-paste.shortcut" }],
});
