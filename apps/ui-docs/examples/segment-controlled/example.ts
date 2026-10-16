import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Segment: Controlled",
  summary: "A two-way selectedKey signal: the Segment writes the picked key, buttons outside write it back.",
  tags: ["segment"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[role=radio]:nth-of-type(2)" },
    { expect: ["#unit", "fahrenheit"] },
    { click: "button:not([role])" },
    { expect: ["#unit", "kelvin"] },
    { attr: ["[role=radio]:nth-of-type(3)", "aria-checked", "true"] },
  ],
});
