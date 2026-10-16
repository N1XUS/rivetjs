import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Dialog with plain CSS",
  summary:
    "No utilities: a stylesheet on the default class names (rv-Button, rv-ModalOverlay, rv-Modal, rv-Dialog, rv-Heading) and the data-entering / data-exiting animation states.",
  tags: ["dialog", "css", "transition"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { attr: ["#css-dialog-trigger", "class", "rv-Button"] },
    { click: "#css-dialog-trigger" },
    { attr: ["#css-dialog", "class", "rv-Dialog"] },
    { matches: ".rv-ModalOverlay > .rv-Modal > #css-dialog" },
    { matches: "#css-dialog > .rv-Heading" },
    { absent: ".rv-ModalOverlay[data-entering]" },
    { key: "Escape" },
    { absent: "#css-dialog" },
  ],
});
