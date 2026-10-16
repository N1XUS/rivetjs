import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: DOM events and attributes",
  summary: "Global DOM events and attributes on the Calendar root, Heading, CalendarGrid and CalendarCell; the grid's own pointer handling runs before yours.",
  tags: ["cdk", "calendar", "dom-events"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#cal", "lang", "en"] },
    { attr: ["#cal", "dir", "ltr"] },
    { attr: ["#cal .rv-Heading", "lang", "en"] },
    { attr: ["#cal table", "translate", "no"] },
    { attr: ['#cal [data-date="2026-10-14"]', "lang", "en"] },
    { click: '#cal [data-date="2026-10-15"]' },
    { expect: ["#log", "root-enter"] },
    { expect: ["#log", "cell-enter:2026-10-15"] },
    { expect: ["#log", "grid-down:0"] },
    // The grid still selected the day.
    { attr: ['#cal [data-date="2026-10-15"]', "data-selected", "true"] },
    { rightclick: '#cal [data-date="2026-10-16"]' },
    { expect: ["#log", "grid-menu"] },
    { dblclick: "#cal .rv-Heading" },
    { expect: ["#log", "heading-dbl"] },
    { expect: ["#log", "root-dbl"] },
  ],
});
