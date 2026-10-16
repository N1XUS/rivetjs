import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "pressProps options",
  summary: "isDisabled as a signal, preventFocusOnPress, allowTextSelectionOnPress and a controlled isPressed.",
  tags: ["cdk", "interactions", "press"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    // Disabled at first: the press does nothing.
    { matches: "#guarded[data-disabled]" },
    { click: "#guarded" },
    { expect: ["#log", "none"] },
    { click: "#toggle" },
    { expect: ["#toggle", "Disable"] },
    { click: "#guarded" },
    { expect: ["#log", "guarded"] },
    // preventFocusOnPress: the press runs, focus stays where it was.
    { press: ["#before", "Tab"] },
    { focused: "#toggle" },
    { click: "#nofocus" },
    { expect: ["#log", "nofocus"] },
    { focused: "#toggle" },
    // Controlled isPressed: pressed while the panel it opens is open.
    { click: "#opener" },
    { matches: "#opener[data-pressed]" },
    { click: "#opener" },
    { absent: "#opener[data-pressed]" },
  ],
});
