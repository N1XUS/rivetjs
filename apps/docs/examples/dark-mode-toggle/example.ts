import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Dark mode toggle",
  summary: "A button that switches between system, light and dark themes, remembers the choice and applies it before the first paint.",
  tags: ["events", "client-effect", "styling"],
  // Its own theme (saved choice, pre-paint script): not the docs frame theme.
  frame: { height: "sm", theme: false },
  show: ["src/routes/index.tsx", "src/document.ts", "src/styles.css"],
  test: [
    { expect: ["#theme", "Theme: system"] },
    { click: "#theme" },
    { expect: ["#theme", "Theme: light"] },
    { click: "#theme" },
    { expect: ["#theme", "Theme: dark"] },
    { click: "#theme" },
    { expect: ["#theme", "Theme: system"] },
  ],
});
