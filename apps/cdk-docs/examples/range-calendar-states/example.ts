import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RangeCalendar: invalid, read-only, disabled",
  summary: "A range outside min / max marks the root and its cells invalid; the errorMessage Text describes them. isReadOnly and isDisabled freeze it.",
  tags: ["cdk", "range-calendar", "states"],
  status: "experimental",
  frame: { height: 550, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#invalid", "data-invalid", "true"] },
    { attr: ['#invalid [slot="errorMessage"]', "id", "invalid-error"] },
    { attr: ['#invalid [data-date="2026-10-22"]', "aria-invalid", "true"] },
    { attr: ['#invalid [data-date="2026-10-22"]', "data-invalid", "true"] },
    { described: ['#invalid [data-date="2026-10-22"]', "Stays end by October 25."] },
    // A valid range clears it.
    { click: '#invalid [data-date="2026-10-21"]' },
    { click: '#invalid [data-date="2026-10-23"]' },
    { attr: ["#invalid", "data-invalid", null] },
    { attr: ['#invalid [data-date="2026-10-22"]', "aria-invalid", null] },
    { attr: ["#readonly table", "aria-readonly", "true"] },
    { press: ['#readonly [data-date="2026-10-12"]', "Enter"] },
    { attr: ['#readonly [data-date="2026-10-12"]', "data-selection-start", null] },
    { attr: ['#readonly [data-date="2026-10-05"]', "data-selection-start", "true"] },
    { attr: ["#disabled", "data-disabled", "true"] },
    { attr: ['#disabled [data-date="2026-10-06"]', "aria-disabled", "true"] },
    { attr: ['#disabled button[aria-label="Next"]', "disabled", ""] },
  ],
});
