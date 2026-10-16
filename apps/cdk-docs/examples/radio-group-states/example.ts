import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Disabled and read-only RadioGroup",
  summary: "A disabled radio skipped by the arrow keys, a disabled group, and a read-only group that keeps its selection.",
  tags: ["radio-group", "disabled", "read-only"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#ship input[value='drone']", "disabled", ""] },
    { press: ["#ship input[value='post']", "ArrowDown"] },
    { matches: "#ship input[value='pickup']:checked" },
    { attr: ["#ship-off", "aria-disabled", "true"] },
    { attr: ["#ship-off input[value='post']", "disabled", ""] },
    { attr: ["#ship-ro", "aria-readonly", "true"] },
    { click: "#ship-ro input[value='pickup']" },
    { matches: "#ship-ro input[value='post']:checked" },
  ],
});
