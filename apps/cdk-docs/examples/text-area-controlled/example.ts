import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Controlled and uncontrolled TextArea",
  summary: "A TextField with a TextArea part whose value is a two-way signal, and an uncontrolled one with defaultValue; rows / wrap go on the TextArea.",
  tags: ["text-area", "state"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#notes", "rows", "3"] },
    { name: ["#notes", "Notes"] },
    { fill: ["#notes", "Line one\nLine two"] },
    { expect: ["#notes-count", "2 line(s)"] },
    { click: "#notes-clear" },
    { expect: ["#notes-count", "0 line(s)"] },
    { expect: ["#poem", "Roses are red"] },
    { attr: ["#poem", "wrap", "off"] },
  ],
});
