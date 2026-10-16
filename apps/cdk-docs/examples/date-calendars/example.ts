import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar systems",
  summary:
    "toCalendar converts one CalendarDate into the Japanese, Buddhist, Hebrew, Islamic, Persian, Indian, Ethiopic or ROC calendar; DateFormatter formats it.",
  tags: ["cdk", "date", "i18n", "options"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#fields", "era reiwa, year 8, month 1, day 15"] },
    { expect: ["#formatted", "8 Reiwa"] },
    { click: "#hebrew" },
    { expect: ["#fields", "era AM, year 5786, month 4, day 26"] },
    { expect: ["#formatted", "Tevet"] },
    { click: "#persian" },
    { expect: ["#fields", "year 1404, month 10, day 25"] },
    { click: "#buddhist" },
    { expect: ["#formatted", "2569 BE"] },
  ],
});
