import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButtonGroup (multiple, controlled)",
  summary:
    'selectionMode="multiple" makes a toolbar of aria-pressed buttons; selectedKeys is a two-way signal written from outside too; lucide icons named by aria-label.',
  tags: ["toggle-button-group", "selection", "state"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#styles", "role", "toolbar"] },
    { attr: ["#styles button:nth-child(1)", "aria-pressed", "true"] },
    { click: "#styles button:nth-child(2)" },
    { expect: ["#styles-value", "Styles: bold, italic"] },
    { attr: ["#styles button:nth-child(2)", "aria-pressed", "true"] },
    { attr: ["#styles button:nth-child(4)", "disabled", ""] },
    { click: "#clear" },
    { attr: ["#styles button:nth-child(1)", "aria-pressed", "false"] },
    { expect: ["#styles-value", "Styles: none"] },
  ],
});
