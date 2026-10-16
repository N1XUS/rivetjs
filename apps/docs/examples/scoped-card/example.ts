import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Scoped card",
  summary: "A card styled with a css`` block. The class names are unique to the file, and the button switches a second class on and off.",
  tags: ["styling", "scoped-styles"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["#toggle", "Select"] }, { click: "#toggle" }, { expect: ["#toggle", "Selected"] }, { click: "#toggle" }, { expect: ["#toggle", "Select"] }],
});
