import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tokens: borders, separators and focus",
  summary:
    "Border widths (--border-width, --field-border-width), the three border and separator levels, and the focus ring (--focus, --ring-offset-width): press Tab to move the ring over real controls. Values are read from the live CSS.",
  tags: ["tokens", "borders", "focus", "theme"],
  status: "experimental",
  frame: { height: 560, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["[data-value='--border-width']", "px"] },
    { expect: ["[data-value='--separator-secondary']", "("] },
    { press: ["#tb-field", "Tab"] },
    // A native `<button>` (ZERO JSLEAK native path): the browser's focus-visible, ring from the `:focus-visible` CSS twin.
    { matches: "#tb-focus-button:focus-visible" },
  ],
});
