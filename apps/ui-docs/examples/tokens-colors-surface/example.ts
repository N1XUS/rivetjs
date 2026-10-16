import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tokens: surface layers",
  summary:
    "The layer tokens stacked as an app uses them: background, surface, secondary and tertiary surfaces, an overlay, a form field, borders and separators. Values are read from the live CSS and follow the theme toggle.",
  tags: ["tokens", "colors", "theme"],
  status: "experimental",
  frame: { height: 520, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-token='--surface']" }, { expect: ["[data-value='--background']", "oklch("] }, { expect: ["[data-value='--separator']", "("] }],
});
