import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tutorial step 4: lists",
  summary: "The books live in one signal and render with For. A computed value counts the read ones.",
  tags: ["tutorial", "lists", "computed"],
  frame: { height: 350, auto: true },
  show: ["src/routes/index.tsx", "src/books.ts"],
  test: [
    { expect: ["#summary", "1 of 3 read"] },
    { click: "#books li:nth-child(1) button" },
    { expect: ["#summary", "2 of 3 read"] },
    { expect: ["#books li:nth-child(1) button", "Read"] },
    { click: "#books li:nth-child(3) button" },
    { expect: ["#summary", "1 of 3 read"] },
  ],
});
