import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Motion gestures",
  summary: "Buttons that grow on hover, shrink while pressed and show focus with whileHover, whilePress and whileFocus.",
  tags: ["motion", "gestures", "resume"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#likes", "0 likes"] },
    { hover: "#like" },
    { click: "#like" },
    { expect: ["#likes", "1 like"] },
    { press: ["#like", "Enter"] },
    { expect: ["#likes", "2 likes"] },
  ],
});
