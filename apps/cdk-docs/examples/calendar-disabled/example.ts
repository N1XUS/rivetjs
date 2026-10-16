import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: disabled and read-only",
  summary: "isDisabled disables every cell and both page buttons; isReadOnly keeps focus and paging but never changes the value.",
  tags: ["cdk", "calendar", "states"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#disabled", "data-disabled", "true"] },
    { attr: ["#disabled table", "aria-disabled", "true"] },
    { attr: ['#disabled [slot="previous"]', "disabled", ""] },
    { attr: ['#disabled [slot="next"]', "disabled", ""] },
    { attr: ['#disabled [data-date="2026-10-14"]', "data-disabled", "true"] },
    { attr: ['#disabled [data-date="2026-10-14"]', "tabindex", null] },
    { attr: ["#readonly table", "aria-readonly", "true"] },
    // A press focuses but never selects.
    { click: '#readonly [data-date="2026-10-20"]' },
    { attr: ['#readonly [data-date="2026-10-20"]', "data-selected", null] },
    { expect: ["#value", "Value: 2026-10-14"] },
    // Paging still works.
    { click: '#readonly [slot="next"]' },
    { expect: ["#readonly .rv-Heading", "November 2026"] },
    { expect: ["#value", "Value: 2026-10-14"] },
  ],
});
