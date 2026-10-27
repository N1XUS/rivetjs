import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSwitch: Feature Announcement",
  summary: "A card that introduces a beta feature and lets people turn it on in place.",
  tags: ["cell-switch"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#cs-feature [data-slot=switch-content]",
    },
    {
      matches: "#cs-feature [data-slot=switch]:has(input:checked)",
    },
  ],
});
