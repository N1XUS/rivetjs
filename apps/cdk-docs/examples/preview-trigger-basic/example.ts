import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PreviewTrigger",
  summary:
    "Profile previews of two links: a non-modal Popover opens on hover or keyboard focus after 600 ms, Tab moves into it, Escape closes it and keeps focus on the link.",
  tags: ["preview-trigger", "popover", "link", "tailwind"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Closed: nothing rendered; the link announces a dialog popup.
    { absent: "#maya-preview" },
    { attr: ["#maya-link", "aria-haspopup", "dialog"] },
    { attr: ["#maya-link", "aria-expanded", "false"] },
    // Keyboard focus opens it after the delay.
    { key: "Tab" },
    { focused: "#maya-link" },
    { matches: "#maya-preview[role=dialog][data-trigger=PreviewTrigger]" },
    { attr: ["#maya-link", "aria-expanded", "true"] },
    { attr: ["#maya-link", "aria-controls", "maya-preview"] },
    { expect: ["#maya-preview", "Maya Chen"] },
    // Tab moves into the preview; its content is interactive.
    { key: "Tab" },
    { focused: "#maya-follow" },
    { key: "Enter" },
    { expect: ["#maya-follow", "Following"] },
    { matches: "#maya-preview" },
    // Escape closes and returns focus to the link.
    { key: "Escape" },
    { absent: "#maya-preview" },
    { focused: "#maya-link" },
    { attr: ["#maya-link", "aria-expanded", "false"] },
  ],
});
