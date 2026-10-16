import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: slots",
  summary:
    "Button slots previous / next take any content, Heading shows the visible range, Text slot errorMessage takes any content; aria-labelledby names the calendar.",
  tags: ["cdk", "calendar", "slots"],
  status: "experimental",
  frame: { height: 349, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ['#cal [slot="previous"]', "Prev"] },
    { matches: '#cal [slot="previous"] svg' },
    { expect: ['#cal [slot="next"]', "Next"] },
    { attr: ['#cal [slot="previous"]', "aria-label", "Previous"] },
    { attr: ["#cal", "aria-labelledby", "trip-label"] },
    { name: ["#cal table", "Departure"] },
    { expect: ['#cal [slot="errorMessage"] strong', "Sold out."] },
    { described: ['#cal [data-date="2026-10-14"]', "Sold out. Pick another day."] },
    { click: '#cal [slot="next"]' },
    { expect: ["#cal .rv-Heading", "November 2026"] },
  ],
});
