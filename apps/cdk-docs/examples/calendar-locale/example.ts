import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: locales and calendar systems",
  summary:
    "I18nProvider sets the language, first weekday and calendar system (-u-ca-islamic-umalqura, -u-ca-japanese); values stay Gregorian ISO strings; RTL mirrors the arrows.",
  tags: ["cdk", "calendar", "i18n"],
  status: "experimental",
  frame: { height: "xl" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // de-DE: German names, weeks start on Monday.
    { expect: ["#de .rv-Heading", "Oktober 2026"] },
    { expect: ["#de thead", "MDMDFSS"] },
    { attr: ['#de [data-date="2026-10-14"]', "aria-label", "Mittwoch, 14. Oktober 2026 ausgewählt"] },
    { attr: ['#de [slot="previous"]', "aria-label", "Zurück"] },
    // Islamic (Umm al-Qura) calendar with Arabic digits; data-date and the value stay ISO.
    { expect: ["#islamic .rv-Heading", "جمادى الأولى ١٤٤٨ هـ"] },
    { expect: ['#islamic [data-date="2026-10-14"]', "٣"] },
    { click: '#islamic [data-date="2026-10-15"]' },
    { expect: ["#hijri-value", "Value: 2026-10-15"] },
    // Japanese imperial era.
    { expect: ["#ja .rv-Heading", "令和8年10月"] },
    // RTL: ArrowLeft moves to the next day.
    { click: '#he [data-date="2026-10-14"]' },
    { press: ['#he [data-date="2026-10-14"]', "ArrowLeft"] },
    { focused: '#he [data-date="2026-10-15"]' },
  ],
});
