import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "MenuTrigger",
  summary: "A menu button: ArrowDown opens the menu on the first item, arrows wrap and skip disabled items, Enter runs onAction, Escape returns focus.",
  tags: ["aria", "menu", "keyboard"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // useOverlayTrigger({ type: "menu" }): aria-haspopup="true".
    { attr: ["#edit-trigger", "aria-haspopup", "true"] },
    // Closed: the menu is not rendered; aria-controls only while open.
    { attr: ["#edit-trigger", "aria-expanded", "false"] },
    { absent: "#edit" },
    { press: ["#edit-trigger", "ArrowDown"] },
    { matches: "#edit" },
    { attr: ["#edit", "role", "menu"] },
    { attr: ["#edit", "aria-labelledby", "edit-trigger"] },
    { attr: ["#edit-trigger", "aria-controls", "edit"] },
    { focused: '[data-key="copy"]' },
    { key: "ArrowDown" },
    { focused: '[data-key="paste"]' },
    // Delete is disabled: skipped.
    { key: "ArrowDown" },
    { focused: '[data-key="rename"]' },
    { key: "ArrowDown" },
    { focused: '[data-key="copy"]' },
    { key: "End" },
    { focused: '[data-key="rename"]' },
    { key: "Enter" },
    { expect: ["#value", "Last action: rename"] },
    { absent: "#edit" },
    { focused: "#edit-trigger" },
    // ArrowUp opens on the last item; Escape closes and refocuses the trigger.
    { key: "ArrowUp" },
    { focused: '[data-key="rename"]' },
    { key: "p" },
    { focused: '[data-key="paste"]' },
    { key: "Escape" },
    { absent: "#edit" },
    { focused: "#edit-trigger" },
    // Space on the trigger opens on the first item; Space on an item activates it.
    { key: "Space" },
    { focused: '[data-key="copy"]' },
    { key: "Space" },
    { expect: ["#value", "Last action: copy"] },
  ],
});
