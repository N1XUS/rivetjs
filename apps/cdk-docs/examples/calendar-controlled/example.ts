import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: controlled value and focus",
  summary: "value and focusedValue are two-way string signals: buttons select, clear and move the focused date (and month); the calendar writes both back.",
  tags: ["cdk", "calendar", "signals"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#value", "Value: 2026-10-14"] },
    { attr: ['#cal [data-date="2026-10-14"]', "tabindex", "0"] },
    // Writing focusedValue moves the roving tab stop.
    { click: "#focus-20" },
    { attr: ['#cal [data-date="2026-10-20"]', "tabindex", "0"] },
    { attr: ['#cal [data-date="2026-10-14"]', "tabindex", "-1"] },
    { click: "#halloween" },
    { expect: ["#value", "Value: 2026-10-31"] },
    { attr: ['#cal [data-date="2026-10-31"]', "data-selected", "true"] },
    { attr: ['#cal [data-date="2026-10-14"]', "data-selected", null] },
    // A focused date in another month moves the visible month.
    { click: "#focus-christmas" },
    { expect: ["#cal .rv-Heading", "December 2026"] },
    { attr: ['#cal [data-date="2026-12-25"]', "tabindex", "0"] },
    // The calendar writes both signals back.
    { press: ['#cal [data-date="2026-12-25"]', "ArrowLeft"] },
    { expect: ["#focused", "Focused: 2026-12-24"] },
    { key: "Enter" },
    { expect: ["#value", "Value: 2026-12-24"] },
    { key: "PageUp" },
    { expect: ["#focused", "Focused: 2026-11-24"] },
    { expect: ["#cal .rv-Heading", "November 2026"] },
    { click: "#clear" },
    { expect: ["#value", "Value: none"] },
  ],
});
