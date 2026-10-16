import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateField: locale and format",
  summary: "The I18nProvider locale orders the segments; shouldForceLeadingZeros pads them; zoned values show their time zone unless hideTimeZone.",
  tags: ["aria", "date", "i18n"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#de", "14.10.2026"] },
    { attr: ["#de-day", "aria-label", "Tag, "] },
    { expect: ["#gb", "dd/mm/yyyy"] },
    { expect: ["#zeros", "03/04/2026"] },
    { expect: ["#zoned", "AM GMT+2"] },
    { attr: ["#zoned-hour", "aria-valuenow", "9"] },
    { attr: ["#zoned-timeZoneName", "role", "textbox"] },
    { absent: "#zoned-hidden-timeZoneName" },
    { expect: ["#zoned-hidden", "10/14/2026, "] },
    { attr: ["#japanese-era", "data-type", "era"] },
    { expect: ["#japanese", "R8/10/14"] },
  ],
});
