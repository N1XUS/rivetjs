import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Menu sections and separators",
  summary:
    "MenuSection groups items (role group, named by its Header or aria-label); Separator divides them without a label; the keyboard moves across sections and skips separators.",
  tags: ["menu", "sections"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["#sec-trigger", "Enter"] },
    { focused: '[data-key="image"]' },
    { attr: ["#sec section:nth-of-type(1)", "role", "group"] },
    { name: ["#sec section:nth-of-type(1)", "Export"] },
    { name: ["#sec section:nth-of-type(2)", "Share"] },
    { name: ["#sec section:nth-of-type(3)", "Settings"] },
    { matches: '#sec > [role="separator"].rv-Separator' },
    // ArrowDown crosses into the next section; the separator is not focusable.
    { key: "ArrowDown" },
    { key: "ArrowDown" },
    { focused: '[data-key="youtube"]' },
    { key: "ArrowDown" },
    { key: "ArrowDown" },
    { focused: '[data-key="print"]' },
    { key: "Enter" },
    { expect: ["#sec-value", "print"] },
    { absent: "#sec" },
  ],
});
