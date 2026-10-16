import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateRangePicker: locales and calendars",
  summary: "The I18nProvider locale orders and names the segments; a -u-ca- extension displays the Japanese calendar while the value stays Gregorian.",
  tags: ["aria", "date", "i18n"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/components/RangePickerParts.tsx", "src/styles.css"],
  test: [
    { expect: ["#de-start", "14.10.2026"] },
    { attr: ["#de-start-day", "aria-label", "Tag, Startdatum, "] },
    { click: "#de-button" },
    { expect: ["#de-dialog .rv-Heading", "Oktober 2026"] },
    // de-DE weeks start on Monday.
    { expect: ["#de-dialog th", "M"] },
    { key: "Escape" },
    { absent: "#de-dialog" },
    // Japanese calendar: an era segment, Reiwa 8 = 2026.
    { expect: ["#ja-start", "R8/10/14"] },
    { attr: ["#ja-start-era", "role", "spinbutton"] },
    { press: ["#ja-end-day", "ArrowUp"] },
    { expect: ["#value", "Value: 2026-10-14 → 2026-10-19"] },
  ],
});
