import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Controlled modal",
  summary: "A Modal outside the menu that opens it: a MenuItem action sets the two-way isOpen signal; isDismissable also closes it on an outside press.",
  tags: ["modal", "dialog", "menu", "signals"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#mc-state", "closed"] },
    { press: ["#mc-menu-trigger", "Enter"] },
    { focused: '#mc-menu [data-key="open"]' },
    { key: "Enter" },
    { matches: "#mc-dialog[role=dialog]" },
    { absent: "#mc-menu" },
    { expect: ["#mc-state", "open"] },
    { focused: "#mc-dialog" },
    // Escape closes it (two-way isOpen writes false).
    { key: "Escape" },
    { absent: "#mc-dialog" },
    { expect: ["#mc-state", "closed"] },
    // The close button (an outside press: tests-components/overlays.test.ts).
    { press: ["#mc-menu-trigger", "Enter"] },
    { focused: '#mc-menu [data-key="open"]' },
    { key: "Enter" },
    { matches: "#mc-dialog[role=dialog]" },
    { click: "#mc-close" },
    { absent: "#mc-dialog" },
    { expect: ["#mc-state", "closed"] },
  ],
});
