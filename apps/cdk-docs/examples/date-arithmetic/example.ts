import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Date arithmetic",
  summary: "CalendarDate add, subtract, set and cycle constrain to valid dates; queries such as startOfWeek and isWeekend take the locale into account.",
  tags: ["cdk", "date", "basic", "options"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#week-us", "2026-01-25"] },
    { expect: ["#week-de", "2026-01-26"] },
    { expect: ["#weekday", "6"] },
    { expect: ["#weekend", "true"] },
    { click: "#add-month" },
    { expect: ["#value", "2026-02-28"] },
    { click: "#reset" },
    { click: "#subtract" },
    { expect: ["#value", "2024-12-31"] },
    { click: "#set-day" },
    { expect: ["#value", "2024-12-01"] },
    { click: "#cycle" },
    { expect: ["#value", "2024-11-01"] },
    { click: "#end" },
    { expect: ["#value", "2024-11-30"] },
  ],
});
