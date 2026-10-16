import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Dropdown: Usage",
  summary: 'Dropdown demo "Usage".',
  tags: ["dropdown"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button[aria-label=Menu]" }, { expect: ["[role=menu]", "New file"] }, { click: "[data-key=copy-link]" }, { absent: "[role=menu]" }],
});
