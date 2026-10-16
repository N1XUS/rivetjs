import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tutorial step 3: state",
  summary: "Each book card keeps a signal. Clicking the button changes only that card's label.",
  tags: ["tutorial", "signals", "events"],
  frame: { height: "md" },
  show: ["src/components/BookCard.tsx", "src/routes/index.tsx"],
  test: [
    { expect: ["#books li:nth-child(2) button", "Not read yet"] },
    { click: "#books li:nth-child(2) button" },
    { expect: ["#books li:nth-child(2) button", "Read"] },
    { expect: ["#books li:nth-child(1) button", "Not read yet"] },
  ],
});
