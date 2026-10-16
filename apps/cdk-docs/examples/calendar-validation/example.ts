import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: validation",
  summary:
    "An unavailable or out-of-range value is invalid: the root gets data-invalid, the cell aria-invalid and aria-describedby the errorMessage Text slot; isInvalid forces it.",
  tags: ["cdk", "calendar", "validation"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#auto", "data-invalid", "true"] },
    { attr: ['#auto [data-date="2026-10-17"]', "aria-invalid", "true"] },
    { attr: ['#auto [data-date="2026-10-17"]', "data-invalid", "true"] },
    { described: ['#auto [data-date="2026-10-17"]', "Pick a weekday."] },
    { matches: '#auto:is([data-invalid]) [slot="errorMessage"]' },
    // A weekday clears the error.
    { click: '#auto [data-date="2026-10-21"]' },
    { attr: ["#auto", "data-invalid", null] },
    { attr: ['#auto [data-date="2026-10-21"]', "aria-invalid", null] },
    { attr: ['#auto [data-date="2026-10-21"]', "data-selected", "true"] },
    { click: "#weekend" },
    { attr: ["#auto", "data-invalid", "true"] },
    { attr: ['#auto [data-date="2026-10-18"]', "aria-invalid", "true"] },
    // isInvalid: always invalid.
    { attr: ["#forced", "data-invalid", "true"] },
    { expect: ['#forced [slot="errorMessage"]', "Rejected by the server."] },
    { click: '#forced [data-date="2026-10-20"]' },
    { attr: ['#forced [data-date="2026-10-20"]', "aria-invalid", "true"] },
    { described: ['#forced [data-date="2026-10-20"]', "Rejected by the server."] },
  ],
});
