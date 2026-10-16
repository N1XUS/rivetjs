import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButton with plain CSS",
  summary: "A plain stylesheet for .rv-ToggleButton: [aria-pressed=true] for the on state, [data-pressed] while pressed, :disabled.",
  tags: ["toggle-button", "css", "styling"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [{ matches: "#css-wrap.rv-ToggleButton" }, { click: "#css-wrap" }, { matches: '#css-wrap[aria-pressed="true"]' }],
});
