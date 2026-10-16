import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Popover: Placement",
  summary: 'Popover demo "Placement".',
  tags: ["popover"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=button]:nth-of-type(1)" }, { matches: ".popover[data-placement]" }, { key: "Escape" }, { absent: "[data-slot=popover-dialog]" }],
});
