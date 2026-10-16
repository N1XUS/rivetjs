import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Controlled and uncontrolled RadioGroup",
  summary:
    "A RadioGroup whose value is a two-way signal (written from a button too) with arrow-key selection, next to an uncontrolled group with defaultValue.",
  tags: ["radio-group", "state", "keyboard"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#size", "role", "radiogroup"] },
    { name: ["#size", "Size"] },
    { attr: ["#size", "aria-orientation", "vertical"] },
    { matches: "#size input[value='m']:checked" },
    { press: ["#size input[value='m']", "ArrowDown"] },
    { matches: "#size input[value='l']:checked" },
    { expect: ["#rg-value", "Size: l"] },
    // Wraps from the last radio to the first.
    { key: "ArrowDown" },
    { matches: "#size input[value='s']:checked" },
    { click: "#pick-m" },
    { matches: "#size input[value='m']:checked" },
    { expect: ["#rg-value", "Size: m"] },
    { matches: "#crust input[value='thin']:checked" },
  ],
});
