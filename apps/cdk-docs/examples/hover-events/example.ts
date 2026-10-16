import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "hoverProps",
  summary: "Hover start and end with the pointer type, isHovered() as data-hovered, moving into a child keeps the hover, and isDisabled.",
  tags: ["cdk", "interactions", "hover"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { absent: "#card[data-hovered]" },
    { click: "#card" },
    { matches: "#card[data-hovered]" },
    { expect: ["#log", "hoverstart:mouse"] },
    // A child is still inside: no end, no new start.
    { click: "#card-child" },
    { expect: ["#changes", "true"] },
    { click: "#away" },
    { absent: "#card[data-hovered]" },
    { expect: ["#log", "hoverstart:mouse hoverend:mouse"] },
    { expect: ["#changes", "true false"] },
    // Disabled: nothing.
    { click: "#disable" },
    { click: "#card" },
    { absent: "#card[data-hovered]" },
    { expect: ["#changes", "true false"] },
  ],
});
