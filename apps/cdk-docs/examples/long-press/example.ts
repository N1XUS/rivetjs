import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "longPressProps",
  summary: "A button with a long press action: start and end events, a threshold, and the accessibility description it points at.",
  tags: ["cdk", "interactions", "press"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { described: ["#record", "Long press to record a voice note"] },
    { matches: "[data-hint][hidden]" },
    // A short click: start and end, no long press (released before the threshold).
    { click: "#record" },
    { expect: ["#log", "longpressstart:mouse longpressend:mouse"] },
    { expect: ["#status", "Idle"] },
    // Keyboard presses are not long presses (pointerType mouse or touch only).
    { press: ["#record", "Enter"] },
    { expect: ["#log", "longpressstart:mouse longpressend:mouse"] },
  ],
});
