import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sheet: Professions Picker",
  summary: "Pick one option from a list in a sheet; the choice is shown on the trigger.",
  tags: ["sheet"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#sheet-profession-trigger" },
    { matches: "[role=dialog][data-slot=sheet-dialog]" },
    { click: "[role=option][data-key=Pilot]" },
    { attr: ["[role=option][data-key=Pilot]", "aria-selected", "true"] },
    { key: "Escape" },
    { absent: "[data-slot=sheet-dialog]" },
    { expect: ["#sheet-profession-trigger", "Pilot"] },
  ],
});
