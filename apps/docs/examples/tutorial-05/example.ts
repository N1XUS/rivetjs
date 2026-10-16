import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tutorial step 5: input",
  summary: "A form adds books to the list. The input is bound to a signal with model:value.",
  tags: ["tutorial", "forms", "input"],
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/books.ts"],
  test: [
    { expect: ["#summary", "1 of 3 read"] },
    { fill: ["#new-title", "Piranesi"] },
    { click: "#add" },
    { expect: ["#books", "Piranesi"] },
    { expect: ["#summary", "1 of 4 read"] },
    { click: "#books li:nth-child(4) button" },
    { expect: ["#summary", "2 of 4 read"] },
  ],
});
