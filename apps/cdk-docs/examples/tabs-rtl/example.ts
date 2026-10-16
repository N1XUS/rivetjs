import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Right-to-left tabs",
  summary: "In right-to-left text ArrowLeft moves to the next tab and ArrowRight to the previous one.",
  tags: ["aria", "tabs", "rtl"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#rtl", "dir", "rtl"] },
    { attr: ["#rtl", "lang", "ar"] },
    { press: ["#rtl-tab-home", "ArrowLeft"] },
    { focused: "#rtl-tab-news" },
    { attr: ["#rtl-tab-news", "aria-selected", "true"] },
    { key: "ArrowLeft" },
    { focused: "#rtl-tab-about" },
    { key: "ArrowRight" },
    { focused: "#rtl-tab-news" },
    { key: "End" },
    { focused: "#rtl-tab-about" },
  ],
});
