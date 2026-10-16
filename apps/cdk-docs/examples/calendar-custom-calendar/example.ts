import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: custom calendar system",
  summary:
    "createCalendar returns a 4-5-4 fiscal calendar (a GregorianCalendar subclass): months of four or five whole weeks; the value stays a Gregorian ISO string.",
  tags: ["cdk", "calendar", "i18n"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/components/Custom454.ts", "src/styles.css"],
  test: [
    { expect: ["#cal .rv-Heading", "October 2026"] },
    { attr: ['#cal [data-date="2026-10-14"]', "data-selected", "true"] },
    // Fiscal October: four whole weeks, October 4 to 31.
    { matches: '#cal tbody tr:first-child td:first-child [data-date="2026-10-04"]' },
    { matches: '#cal tbody tr:nth-child(4) td:last-child [data-date="2026-10-31"]' },
    { absent: "#cal tbody tr:nth-child(5)" },
    { click: '#cal [data-date="2026-10-21"]' },
    { expect: ["#value", "Selected: 2026-10-21"] },
    { click: '#cal [slot="next"]' },
    { expect: ["#cal .rv-Heading", "November 2026"] },
    { matches: '#cal tbody tr:nth-child(4) td:last-child [data-date="2026-11-28"]' },
    // Fiscal December: five weeks, November 29 to January 2.
    { click: '#cal [slot="next"]' },
    { expect: ["#cal .rv-Heading", "December 2026"] },
    { matches: '#cal tbody tr:first-child td:first-child [data-date="2026-11-29"]' },
    { matches: '#cal tbody tr:nth-child(5) td:last-child [data-date="2027-01-02"]' },
  ],
});
