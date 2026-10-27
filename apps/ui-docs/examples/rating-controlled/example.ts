import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Rating: controlled",
  summary: "A signal holds the value; the text follows the picked star.",
  tags: ["rating"],
  status: "experimental",
  frame: { height: 160 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#rt-controlled input:checked[value='3']",
    },
    {
      click: "#rt-controlled .rating__item:nth-child(5)",
    },
    {
      expect: ["#rt-controlled-value", "5 of 5"],
    },
  ],
});
