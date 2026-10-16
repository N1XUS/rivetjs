import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tokens: semantic colors",
  summary:
    "Every semantic color family (accent, default, success, warning, danger) as swatches: solid, hover, soft and soft hover, each with its foreground (the Aa text). The values are read from the live CSS, so they follow the theme toggle.",
  tags: ["tokens", "colors", "theme"],
  status: "experimental",
  frame: { height: 560, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-token='--accent']" }, { expect: ["[data-value='--accent']", "oklch("] }, { expect: ["[data-value='--danger-soft']", "("] }],
});
