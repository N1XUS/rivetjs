import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: visible duration, paging and alignment",
  summary:
    "visibleDuration shows several months (a CalendarGrid and CalendarHeading per month offset) or one week; pageBehavior picks the page size; selectionAlignment places the value.",
  tags: ["cdk", "calendar", "layout"],
  status: "experimental",
  frame: { height: 942, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#two", "aria-label", "Two months, October to November 2026"] },
    { attr: ["#two .month:nth-child(1) table", "aria-label", "Two months, October 2026"] },
    { attr: ["#two .month:nth-child(2) table", "aria-label", "Two months, November 2026"] },
    { expect: ["#two .month:nth-child(1) .rv-CalendarHeading", "October 2026"] },
    { expect: ["#two .month:nth-child(2) .rv-CalendarHeading", "November 2026"] },
    { click: '#two [slot="next"]' },
    { attr: ["#two", "aria-label", "Two months, December 2026 to January 2027"] },
    { expect: ["#two .month:nth-child(2) .rv-CalendarHeading", "January 2027"] },
    { attr: ["#single table:nth-of-type(1)", "aria-label", "Paged by one, October 2026"] },
    { click: '#single [slot="next"]' },
    { attr: ["#single", "aria-label", "Paged by one, November to December 2026"] },
    { attr: ["#end", "aria-label", "Aligned end, August to October 2026"] },
    { attr: ["#end table:nth-of-type(3)", "aria-label", "Aligned end, October 2026"] },
    { attr: ["#week", "aria-label", "This week, October 11 to 17, 2026"] },
    { expect: ["#week .rv-Heading", "October 11"] },
    { expect: ["#week .rv-Heading", "17, 2026"] },
    { press: ['#week [data-date="2026-10-14"]', "End"] },
    { focused: '#week [data-date="2026-10-17"]' },
  ],
});
