import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: state functions",
  summary:
    "A component inside the Calendar reads CalendarStateContext and drives it with the @rivetjs/cdk/state/calendar functions (focusNextPage(state), setValue(state, date), …).",
  tags: ["cdk", "calendar", "state"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#description", "Selected Date: Wednesday, October 14, 2026"] },
    { expect: ["#value", "value: 2026-10-14"] },
    { click: "#next" },
    { expect: ["#cal .rv-Heading", "November 2026"] },
    { expect: ["#focused", "focused: 2026-11-14"] },
    { attr: ['#cal [data-date="2026-11-14"]', "tabindex", "0"] },
    { click: "#start" },
    { expect: ["#focused", "focused: 2026-11-01"] },
    { click: "#select-focused" },
    { expect: ["#value", "value: 2026-11-01"] },
    { expect: ["#description", "Sunday, November 1, 2026"] },
    { attr: ['#cal [data-date="2026-11-01"]', "data-selected", "true"] },
    { click: "#clear" },
    { expect: ["#value", "value: none"] },
    { expect: ["#description", "No selection"] },
    { click: "#prev" },
    { expect: ["#cal .rv-Heading", "October 2026"] },
  ],
});
