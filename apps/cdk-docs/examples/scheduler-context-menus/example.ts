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
  // Repeated delete/create and duplicate flows must retain distinct event identities.
  test: [
    {
      expect: ["#event-count", "Events: 2"],
    },
    {
      press: ['[data-rv-event-id="design"]', "Shift+F10"],
    },
    {
      click: '[role="menuitem"][data-key="rename-event"]',
    },
    {
      absent: ".rv-SchedulerMenu-popover",
    },
    {
      expect: ['[data-rv-event-id="design"]', "(edited)"],
    },
    {
      press: ['[data-rv-event-id="design"]', "Shift+F10"],
    },
    {
      click: '[role="menuitem"][data-key="duplicate-event"]',
    },
    {
      expect: ["#event-count", "Events: 3"],
    },
    {
      absent: ".rv-SchedulerMenu-popover",
    },
    {
      matches: '[data-rv-event-id="copy-2"]',
    },
    {
      press: ['[data-rv-event-id="design"]', "Shift+F10"],
    },
    {
      click: '[role="menuitem"][data-key="delete-event"]',
    },
    {
      absent: ".rv-SchedulerMenu-popover",
    },
    {
      click: "#confirm-delete",
    },
    {
      expect: ["#event-count", "Events: 2"],
    },
    {
      absent: '[data-rv-event-id="design"]',
    },
    {
      expect: ["#menu-log", "Deleted event"],
    },
    {
      press: ['[data-rv-event-id="offsite"]', "Shift+F10"],
    },
    {
      click: '[role="menuitem"][data-key="duplicate-event"]',
    },
    {
      expect: ["#event-count", "Events: 3"],
    },
    {
      absent: ".rv-SchedulerMenu-popover",
    },
    {
      matches: '[data-rv-event-id="copy-3"]',
    },
    {
      expect: ['[data-rv-event-id="copy-2"]', "Design review"],
    },
    {
      expect: ['[data-rv-event-id="copy-3"]', "Offsite"],
    },
    {
      press: ['[data-rv-event-id="copy-2"]', "Shift+F10"],
    },
    {
      click: '[role="menuitem"][data-key="rename-event"]',
    },
    {
      absent: ".rv-SchedulerMenu-popover",
    },
    {
      expect: ['[data-rv-event-id="copy-2"]', "(copy) (edited)"],
    },
    {
      absent: '[data-rv-event-id="copy-3"][aria-label*="edited"]',
    },
    {
      press: ['[data-rv-event-id="copy-2"]', "Shift+F10"],
    },
    {
      click: '[role="menuitem"][data-key="delete-event"]',
    },
    {
      absent: ".rv-SchedulerMenu-popover",
    },
    {
      click: "#confirm-delete",
    },
    {
      expect: ["#event-count", "Events: 2"],
    },
    {
      absent: '[data-rv-event-id="copy-2"]',
    },
    {
      matches: '[data-rv-event-id="copy-3"]',
    },
    {
      press: ['[data-rv-day-index="21"][data-rv-minutes="all-day"]', "Shift+ArrowRight"],
    },
    {
      attr: ['[data-rv-day-index="22"][data-rv-minutes="all-day"]', "aria-selected", "true"],
    },
    {
      key: "Shift+F10",
    },
    {
      click: '[role="menuitem"][data-key="new-event"]',
    },
    {
      expect: ["#event-count", "Events: 3"],
    },
    {
      absent: ".rv-SchedulerMenu-popover",
    },
    {
      expect: ["#menu-log", "Created selected range"],
    },
    {
      matches: '[data-rv-event-id="new-4"]',
    },
    {
      press: ['[data-rv-day-index="28"][data-rv-minutes="all-day"]', "Shift+F10"],
    },
    {
      click: '[role="menuitem"][data-key="new-event"]',
    },
    {
      expect: ["#event-count", "Events: 4"],
    },
    {
      absent: ".rv-SchedulerMenu-popover",
    },
    {
      matches: '[data-rv-event-id="new-5"]',
    },
    {
      press: ['[data-rv-event-id="new-4"]', "Shift+F10"],
    },
    {
      click: '[role="menuitem"][data-key="delete-event"]',
    },
    {
      absent: ".rv-SchedulerMenu-popover",
    },
    {
      click: "#confirm-delete",
    },
    {
      expect: ["#event-count", "Events: 3"],
    },
    {
      absent: '[data-rv-event-id="new-4"]',
    },
    {
      press: ['[data-rv-day-index="28"][data-rv-minutes="all-day"]', "Shift+F10"],
    },
    {
      click: '[role="menuitem"][data-key="new-event"]',
    },
    {
      expect: ["#event-count", "Events: 4"],
    },
    {
      absent: ".rv-SchedulerMenu-popover",
    },
    {
      matches: '[data-rv-event-id="new-6"]',
    },
    {
      expect: ['[data-rv-event-id="new-5"]', "New event 5"],
    },
    {
      expect: ['[data-rv-event-id="new-6"]', "New event 6"],
    },
    {
      press: ['[data-rv-event-id="new-5"]', "Shift+F10"],
    },
    {
      click: '[role="menuitem"][data-key="rename-event"]',
    },
    {
      absent: ".rv-SchedulerMenu-popover",
    },
    {
      expect: ['[data-rv-event-id="new-5"]', "New event 5 (edited)"],
    },
    {
      absent: '[data-rv-event-id="new-6"][aria-label*="edited"]',
    },
    {
      press: ['[data-rv-event-id="new-5"]', "Shift+F10"],
    },
    {
      click: '[role="menuitem"][data-key="delete-event"]',
    },
    {
      absent: ".rv-SchedulerMenu-popover",
    },
    {
      click: "#confirm-delete",
    },
    {
      expect: ["#event-count", "Events: 3"],
    },
    {
      absent: '[data-rv-event-id="new-5"]',
    },
    {
      matches: '[data-rv-event-id="new-6"]',
    },
    {
      matches: '[data-rv-event-id="copy-3"]',
    },
    {
      matches: '[data-rv-event-id="offsite"]',
    },
  ],
});
