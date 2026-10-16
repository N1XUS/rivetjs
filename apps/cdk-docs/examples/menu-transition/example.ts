import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Menu transitions",
  summary: "data-entering / data-exiting on the Popover (Tailwind entering: / exiting:) animate the menu; it stays mounted until its exit transition ends.",
  tags: ["menu", "transition", "tailwind"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { press: ["#tr-trigger", "Enter"] },
    { matches: ".tr-popover" },
    { focused: '[data-key="one"]' },
    { key: "Escape" },
    // Exiting: data-exiting while the exit transition runs (C1b Popover), then removed.
    { absent: ".tr-popover" },
    { focused: "#tr-trigger" },
  ],
});
