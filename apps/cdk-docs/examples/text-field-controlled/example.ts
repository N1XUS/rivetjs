import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Controlled and uncontrolled TextField",
  summary: "A TextField whose value is a two-way signal (typed into and written from a button), and an uncontrolled one with defaultValue.",
  tags: ["text-field", "state"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { name: ["#name", "Name"] },
    { attr: ["#name-label", "for", "name"] },
    { described: ["#name", "As on your passport."] },
    { fill: ["#name", "Ada"] },
    { expect: ["#greeting", "Hello, Ada!"] },
    { click: "#clear-name" },
    { expect: ["#greeting", "Hello, stranger!"] },
    { attr: ["#city", "value", "Lisbon"] },
  ],
});
