import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TooltipTrigger",
  summary:
    "TooltipTrigger around a Button and its Tooltip with an OverlayArrow: keyboard focus opens it at once, Escape or Tab away closes it, aria-describedby links it while open.",
  tags: ["tooltip", "keyboard"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Closed: nothing rendered, no description.
    { absent: "#tip-edit" },
    { attr: ["#tip-edit-button", "aria-describedby", null] },
    // Keyboard focus opens it immediately (no delay).
    { key: "Tab" },
    { focused: "#tip-edit-button" },
    { matches: "#tip-edit[role=tooltip].rv-Tooltip" },
    { described: ["#tip-edit-button", "Edit"] },
    { attr: ["#tip-edit", "data-placement", "top"] },
    { matches: "#tip-edit > .rv-OverlayArrow[data-placement=top] > .tip" },
    // Escape closes; focus stays.
    { key: "Escape" },
    { absent: "#tip-edit" },
    { focused: "#tip-edit-button" },
    { attr: ["#tip-edit-button", "aria-describedby", null] },
    // The next trigger: Tab away closes the first and opens the second.
    { key: "Tab" },
    { absent: "#tip-edit" },
    { matches: "#tip-delete" },
    { described: ["#tip-delete-button", "Delete"] },
    { key: "Tab" },
    { absent: "#tip-delete" },
  ],
});
