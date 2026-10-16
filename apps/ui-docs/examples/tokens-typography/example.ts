import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tokens: typography",
  summary:
    "The type scale (text-xs … text-4xl) with each step's measured size and line height, the weights, the sans and mono families, and tabular figures for numbers that line up. Values are read from the live CSS.",
  tags: ["tokens", "typography", "theme"],
  status: "experimental",
  frame: { height: 720, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["[data-value='text-sm']", "14px"] }, { expect: ["[data-value='font-semibold']", "600"] }],
});
