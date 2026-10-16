import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Dialog with Tailwind",
  summary: "No theme: utilities via class on each part (Button, ModalOverlay, Modal, Dialog), entering: / exiting: variants for the transitions.",
  tags: ["dialog", "tailwind", "transition"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#tw-dialog-trigger", "class", "rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white aria-expanded:bg-indigo-800"] },
    { click: "#tw-dialog-trigger" },
    { matches: "#tw-dialog.rounded-xl" },
    { matches: ".fixed.inset-0.bg-black\\/40" },
    // The enter transition settles: data-entering is removed.
    { absent: "#tw-modal[data-entering]" },
    { matches: "#tw-dialog.shadow-2xl" },
    { click: "#tw-dialog-close" },
    // While leaving: data-exiting; removed once the transition ends.
    { absent: "#tw-dialog" },
    { focused: "#tw-dialog-trigger" },
    // Reopen after the leave transition: the render-function content is there again, Escape closes.
    { click: "#tw-dialog-trigger" },
    { matches: "#tw-dialog.rounded-xl" },
    { matches: "#tw-dialog-close" },
    { key: "Escape" },
    { absent: "#tw-dialog" },
    { click: "#tw-dialog-trigger" },
    { matches: "#tw-dialog-close" },
  ],
});
