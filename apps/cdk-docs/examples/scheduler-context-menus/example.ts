import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Scheduler: Event and slot context menus",
  summary: "Create from a selected range; rename, duplicate or request deletion from an event menu, then confirm removal.",
  tags: ["scheduler", "context-menus"],
  status: "experimental",
  frame: {
    height: 640,
    auto: true,
  },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    {
      press: ['[data-rv-event-id="design"]', "Shift+F10"],
    },
    {
      matches: '[role="menu"]',
    },
    {
      click: '[role="menuitem"][data-key="rename-event"]',
    },
    { absent: ".rv-SchedulerMenu-popover" },
    {
      expect: ['[data-rv-event-id="design"]', "(edited)"],
    },
    {
      press: ['[data-rv-event-id="design"]', "Shift+F10"],
    },
    {
      click: '[role="menuitem"][data-key="duplicate-event"]',
    },
    { absent: ".rv-SchedulerMenu-popover" },
    {
      matches: '[data-rv-event-id="copy-2"]',
    },
    {
      press: ['[data-rv-event-id="design"]', "Shift+F10"],
    },
    {
      click: '[role="menuitem"][data-key="delete-event"]',
    },
    { absent: ".rv-SchedulerMenu-popover" },
    {
      click: "#confirm-delete",
    },
    {
      absent: '[data-rv-event-id="design"]',
    },
    {
      expect: ["#menu-log", "Deleted event"],
    },
    {
      press: ['[data-rv-day-index="21"][data-rv-minutes="all-day"]', "Shift+ArrowRight"],
    },
    { attr: ['[data-rv-day-index="22"][data-rv-minutes="all-day"]', "aria-selected", "true"] },
    { key: "Shift+F10" },
    {
      click: '[role="menuitem"][data-key="new-event"]',
    },
    {
      expect: ["#menu-log", "Created selected range"],
    },
  ],
});
