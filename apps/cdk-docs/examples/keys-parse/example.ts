import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Parse shortcuts",
  summary:
    "parseKeyboardShortcut and canonicalKeyboardShortcut normalize binding strings; keyboardEventToCanonicalShortcut gives the same form for a keydown event.",
  tags: ["cdk", "keys", "keyboard"],
  status: "experimental",
  frame: { height: 228, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#detail", '"mod":true'] },
    { expect: ["#canonical", "+Shift+k"] },
    { fill: ["#spec", "Control+alt+ArrowUp"] },
    { expect: ["#canonical", "Canonical: Alt+Control+arrowup"] },
    { fill: ["#spec", "esc"] },
    { expect: ["#canonical", "Canonical: escape"] },
    { fill: ["#spec", "Shift+"] },
    { expect: ["#canonical", "Canonical: error"] },
    { expect: ["#detail", "Invalid keyboard shortcut"] },
    { press: ["#record", "Alt+Shift+K"] },
    { expect: ["#pressed", "Event: Alt+Shift+k"] },
  ],
});
