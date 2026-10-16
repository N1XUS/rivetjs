import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorField: hex and channels",
  summary: "A hex ColorField and three channel fields (hue, saturation, lightness) over one Signal; Enter or blur commits, arrows increment.",
  tags: ["color-field", "signal", "tailwind"],
  status: "experimental",
  frame: { height: 184, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#hex input", "value", "#3366CC"] },
    { fill: ["#hex input", "#ff8800"] },
    { press: ["#hex input", "Enter"] },
    { expect: ["#field-value", "#FF8800"] },
    { press: ["#hue input", "ArrowUp"] },
    { expect: ["#field-value", "#FF8C00"] },
    { press: ["#hex input", "ArrowUp"] },
    { expect: ["#field-value", "#FF8C01"] },
  ],
});
