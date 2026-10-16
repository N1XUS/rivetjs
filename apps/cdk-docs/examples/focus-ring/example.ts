import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "useFocusRing",
  summary: "A focus ring only for keyboard focus: on a button, and with within: true around a search field (isTextInput).",
  tags: ["cdk", "focus", "a11y"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    // Mouse focus: focused, no ring.
    { click: "#save" },
    { matches: "#save[data-focused]" },
    { absent: "#save[data-focus-visible]" },
    // Keyboard focus: ring.
    { press: ["#before", "Tab"] },
    { focused: "#save" },
    { matches: "#save[data-focus-visible]" },
    { key: "Tab" },
    { focused: "#query" },
    { absent: "#save[data-focused]" },
    { matches: "#search[data-focus-visible]" },
    // Typing in a text input keeps the ring (only Tab / Escape change modality there).
    { key: "x" },
    { matches: "#search[data-focus-visible]" },
    { click: "#query" },
    { absent: "#search[data-focus-visible]" },
  ],
});
