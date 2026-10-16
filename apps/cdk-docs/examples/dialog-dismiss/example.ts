import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Dismissing a modal",
  summary:
    "isDismissable closes on a click on the underlay, isKeyboardDismissDisabled ignores Escape, shouldCloseOnInteractOutside filters what counts as outside.",
  tags: ["dialog", "modal", "dismiss"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // isDismissable: a click on the underlay (outside the modal element) closes; a visually hidden
    // Dismiss button is rendered in the modal.
    { click: "#light-trigger" },
    { matches: "#light" },
    { attr: [".rv-Modal:has(#light) button[aria-label=Dismiss]", "tabindex", "-1"] },
    { click: ".rv-ModalOverlay" },
    { absent: "#light" },
    { focused: "#light-trigger" },
    // Default: neither Escape-less nor dismissable — an underlay click keeps it open, Escape closes.
    { click: "#plain-trigger" },
    { matches: "#plain" },
    { absent: ".rv-Modal:has(#plain) button[aria-label=Dismiss]" },
    { click: ".rv-ModalOverlay" },
    { matches: "#plain" },
    { key: "Escape" },
    { absent: "#plain" },
    // isKeyboardDismissDisabled: Escape does nothing; the Done button closes.
    { click: "#locked-trigger" },
    { matches: "#locked" },
    { key: "Escape" },
    { matches: "#locked" },
    { click: "#locked-done" },
    { absent: "#locked" },
    // shouldCloseOnInteractOutside returns false for the underlay: dismissable, but the click is ignored.
    { click: "#filtered-trigger" },
    { matches: "#filtered" },
    { click: ".rv-ModalOverlay" },
    { matches: "#filtered" },
    { key: "Escape" },
    { absent: "#filtered" },
  ],
});
