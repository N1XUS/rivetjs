import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "theme.css with your tokens",
  summary: "The optional @rivetjs/cdk/theme.css starter look with the accent, selection and radius tokens overridden on :root.",
  tags: ["styling", "theme", "css"],
  status: "experimental",
  frame: { height: 325, auto: true },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { attr: ["#pin", "class", "rv-ToggleButton"] },
    { click: "#pin" },
    { attr: ["#pin", "aria-pressed", "true"] },
    { attr: ['#view [data-key="board"]', "aria-selected", "true"] },
    { click: '#view [data-key="list"]' },
    { attr: ['#view [data-key="list"]', "aria-selected", "true"] },
    { attr: ['#view [data-key="board"]', "aria-selected", "false"] },
  ],
});
