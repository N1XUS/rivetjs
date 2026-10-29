import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorInputGroup: Parts",
  summary:
    "ColorInputGroup Root, Prefix, Input and Suffix inside ColorField (the same parts as ColorField.Group / Input / Prefix / Suffix), primary and secondary full-width variants.",
  tags: ["color-input-group", "color-field"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#cig-brand-value", "#7C3AED"] },
    { fill: ["[data-slot=color-field]:has(#cig-brand-value) input", "#10B981"] },
    { key: "Enter" },
    { expect: ["#cig-brand-value", "#10B981"] },
    { matches: "[data-slot=color-input-group].color-input-group--secondary.color-input-group--full-width" },
  ],
});
