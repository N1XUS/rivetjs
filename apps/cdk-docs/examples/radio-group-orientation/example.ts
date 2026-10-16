import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Horizontal and RTL RadioGroup",
  summary: 'orientation="horizontal" (aria-orientation and data-orientation) and a group in a dir="rtl" container, where ArrowLeft moves forward.',
  tags: ["radio-group", "orientation", "rtl", "keyboard"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#align", "aria-orientation", "horizontal"] },
    { attr: ["#align", "data-orientation", "horizontal"] },
    { press: ["#align input[value='left']", "ArrowRight"] },
    { matches: "#align input[value='center']:checked" },
    { press: ["#rtl input[value='a']", "ArrowLeft"] },
    { matches: "#rtl input[value='b']:checked" },
  ],
});
