import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Non-modal popover",
  summary: "isNonModal: no underlay, no focus trap, the page stays interactive; focus moving out closes it. isKeyboardDismissDisabled: Escape is ignored.",
  tags: ["popover", "modal", "dismiss"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#nm-trigger" },
    { matches: "#nm" },
    // No underlay, nothing inert (`inert` sits on the outermost element without the popover: the app root).
    { absent: "[data-rv-underlay]" },
    { absent: ":is(#nm-outside[inert], [inert] #nm-outside)" },
    { focused: "#nm" },
    { key: "Tab" },
    { focused: "#nm-inside" },
    // Tab leaves the popover: focus moved outside, so it closes (shouldCloseOnBlur).
    { key: "Tab" },
    { absent: "#nm" },
    // A modal popover with Escape disabled: an outside click still closes it.
    { click: "#locked-trigger" },
    { matches: "#locked" },
    { matches: "[data-rv-underlay]" },
    { matches: ":is(#nm-outside[inert], [inert] #nm-outside)" },
    { key: "Escape" },
    { matches: "#locked" },
    { click: "body" },
    { absent: "#locked" },
  ],
});
