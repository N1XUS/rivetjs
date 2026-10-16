import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Date values in state",
  summary: "stringifyDateValue / parseDateValue round-trip CalendarDate, ZonedDateTime and Time (calendar included) so signals hold plain strings.",
  tags: ["cdk", "date", "controlled"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#stored", "signal: 2026-01-15[u-ca=japanese]"] },
    { expect: ["#parsed", "CalendarDate (japanese)"] },
    { click: "#zoned" },
    { expect: ["#stored", "2026-03-29T03:30:00+02:00[Europe/Berlin]"] },
    { expect: ["#parsed", "ZonedDateTime (gregory)"] },
    { click: "#time" },
    { expect: ["#stored", "signal: 10:35:00"] },
    { expect: ["#parsed", "Time"] },
    { click: "#absolute" },
    { expect: ["#stored", "2026-01-15T07:00:00-05:00[America/New_York]"] },
    { expect: ["#duration", '"days":1,"hours":2'] },
  ],
});
