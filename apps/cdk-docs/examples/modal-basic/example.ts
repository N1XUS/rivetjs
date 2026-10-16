import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Modal",
  summary:
    "DialogTrigger > Button + Modal > Dialog: an overlay that blocks the page; the autofocus field takes focus, Tab stays inside, Escape closes, focus returns.",
  tags: ["modal", "dialog", "overlay"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#signup-trigger", "aria-expanded", "false"] },
    { absent: "#signup" },
    { click: "#signup-trigger" },
    // A Modal alone wraps itself in a ModalOverlay.
    { matches: ".rv-ModalOverlay > .rv-Modal #signup[role=dialog]" },
    { name: ["#signup", "Subscribe to our newsletter"] },
    { focused: "#signup-name" },
    // The page behind is inert.
    { matches: "#signup-trigger[inert], [inert] #signup-trigger" },
    { key: "Escape" },
    { absent: "#signup" },
    { focused: "#signup-trigger" },
    { click: "#signup-trigger" },
    { fill: ["#signup-email", "ada@example.com"] },
    { click: "#signup-submit" },
    { absent: "#signup" },
    { expect: ["#signup-value", "Subscribed: ada@example.com"] },
  ],
});
