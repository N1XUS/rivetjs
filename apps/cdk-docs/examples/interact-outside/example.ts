import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "watchInteractOutside",
  summary: "Counts presses outside a panel: onInteractOutsideStart on pointer down, onInteractOutside on the click, isDisabled as a signal.",
  tags: ["cdk", "interactions"],
  status: "experimental",
  frame: { height: 190, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#inside" },
    { expect: ["#count", "Outside: 0 (starts 0)"] },
    { click: "#outside" },
    { expect: ["#count", "Outside: 1 (starts 1)"] },
    { click: "#pause" },
    { click: "#outside" },
    { expect: ["#count", "Outside: 1 (starts 1)"] },
  ],
});
