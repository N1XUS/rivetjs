import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DatePicker: locale and calendars",
  summary: "The I18nProvider locale formats the field and the calendar; a -u-ca- extension displays another calendar system while the value stays gregorian.",
  tags: ["aria", "date", "i18n"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#de-field", "14.10.2026"] },
    { attr: ["#de-field-day", "aria-label", "Tag, "] },
    { attr: ["#de-button", "aria-label", "Kalender"] },
    { click: "#de-button" },
    { expect: ["#de-dialog .rv-Heading", "Oktober 2026"] },
    { expect: ["#de-dialog th", "M"] },
    { key: "Escape" },
    { absent: "#de-dialog" },
    { attr: ["#ja-field-era", "data-type", "era"] },
    { expect: ["#ja-field", "R8/10/14"] },
  ],
});
