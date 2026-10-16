import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Disabled and unfocusable Buttons",
  summary: "isDisabled renders a disabled button; excludeFromTabOrder keeps a button out of the Tab order; preventFocusOnPress presses without moving focus.",
  tags: ["button", "disabled", "focus"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#off", "disabled", ""] },
    { attr: ["#off", "data-disabled", "true"] },
    { attr: ["#skip", "tabindex", "-1"] },
    // Tab from the first button skips the disabled and the excluded ones.
    { press: ["#first", "Tab"] },
    { focused: "#last" },
    // preventFocusOnPress: focus stays on #last while the press runs.
    { click: "#keep-focus" },
    { expect: ["#log", "keep-focus"] },
    { focused: "#last" },
    { click: "#skip" },
    { expect: ["#log", "skip"] },
  ],
});
