import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Select",
  summary: "A labelled select: the trigger shows the value or a placeholder, a click opens the listbox popover, arrows and typeahead work open and closed.",
  tags: ["select", "listbox", "forms"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Closed: a button with aria-haspopup="listbox", the placeholder, no popover.
    { attr: ["#pet-trigger", "aria-haspopup", "listbox"] },
    { attr: ["#pet-trigger", "aria-expanded", "false"] },
    { expect: ["#pet-value", "Select an item"] },
    { matches: "#pet-value[data-placeholder]" },
    { name: ["#pet-trigger", "Favorite animal"] },
    { described: ["#pet-trigger", "Pick one."] },
    { absent: "#pet-listbox" },
    // The hidden native select carries the value for the form.
    { attr: ["#pet-hidden", "name", "animal"] },
    // A mouse press opens on pointerdown; clicking an option selects it and closes.
    { click: "#pet-trigger" },
    { matches: "#pet-listbox[role=listbox]" },
    { attr: ["#pet-trigger", "aria-expanded", "true"] },
    { attr: ["#pet-trigger", "aria-controls", "pet-listbox"] },
    { matches: "#pet[data-open]" },
    { click: "#pet-listbox-option-dog" },
    { absent: "#pet-listbox" },
    { expect: ["#pet-value", "Dog"] },
    { expect: ["#pet-out", "Selected: dog"] },
    { focused: "#pet-trigger" },
    { absent: "#pet-value[data-placeholder]" },
    // ArrowDown opens on the selected option; arrows move, Enter selects.
    { key: "ArrowDown" },
    { focused: "#pet-listbox-option-dog" },
    { attr: ["#pet-listbox-option-dog", "aria-selected", "true"] },
    { key: "ArrowDown" },
    { focused: "#pet-listbox-option-kangaroo" },
    { key: "Enter" },
    { absent: "#pet-listbox" },
    { expect: ["#pet-out", "Selected: kangaroo"] },
    // Closed: ArrowLeft / ArrowRight change the value, typing selects by text.
    { key: "ArrowRight" },
    { expect: ["#pet-out", "Selected: panda"] },
    { key: "ArrowLeft" },
    { expect: ["#pet-out", "Selected: kangaroo"] },
    { key: "c" },
    { expect: ["#pet-out", "Selected: cat"] },
    // Escape closes and returns focus to the trigger.
    { key: "ArrowUp" },
    { focused: "#pet-listbox-option-cat" },
    { key: "Escape" },
    { absent: "#pet-listbox" },
    { focused: "#pet-trigger" },
    { expect: ["#pet-value", "Cat"] },
  ],
});
