import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Controlled and uncontrolled ToggleButton",
  summary: "isSelected as a two-way signal (also set from outside), defaultSelected for an uncontrolled toggle, and an icon toggle named by aria-label.",
  tags: ["toggle-button", "state"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#pin", "aria-pressed", "false"] },
    { attr: ["#star", "aria-pressed", "true"] },
    { attr: ["#star", "data-selected", "true"] },
    { name: ["#star", "Favourite"] },
    { click: "#pin" },
    { attr: ["#pin", "aria-pressed", "true"] },
    { expect: ["#pin-state", "Pinned: yes"] },
    // Writing the signal updates the button.
    { click: "#unpin" },
    { attr: ["#pin", "aria-pressed", "false"] },
    { expect: ["#pin-state", "Pinned: no"] },
    { press: ["#star", "Space"] },
    { attr: ["#star", "aria-pressed", "false"] },
    { attr: ["#star", "data-selected", null] },
  ],
});
