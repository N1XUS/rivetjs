import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Controlled popover",
  summary:
    "A standalone Popover anchored to another element (triggerRef) and opened by an isOpen signal; a controlled DialogTrigger with isOpen and onOpenChange.",
  tags: ["popover", "signals", "controlled"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#pc-state", "closed"] },
    { absent: "#pc" },
    { click: "#pc-open" },
    { matches: "#pc[role=dialog]" },
    { expect: ["#pc-state", "open"] },
    { name: ["#pc", "Unread"] },
    // Anchored below the badge, not the button that opened it.
    { attr: ["#pc", "data-placement", "bottom"] },
    { click: "#pc-done" },
    { absent: "#pc" },
    { expect: ["#pc-state", "closed"] },
    { click: "#pc-menu-trigger" },
    { matches: "#pc-menu" },
    { expect: ["#pc-log", "options open: open"] },
    { click: "#pc-menu-close" },
    { absent: "#pc-menu" },
    { expect: ["#pc-log", "options closed: open close"] },
  ],
});
