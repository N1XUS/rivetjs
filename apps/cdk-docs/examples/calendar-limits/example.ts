import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: min, max and unavailable dates",
  summary: "minValue / maxValue disable the dates outside and the page buttons at the edges; isDateUnavailable marks dates that cannot be selected.",
  tags: ["cdk", "calendar", "validation"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ['#cal [slot="previous"]', "disabled", ""] },
    { attr: ['#cal [data-date="2015-10-07"]', "data-disabled", "true"] },
    { attr: ['#cal [data-date="2015-10-07"]', "aria-disabled", "true"] },
    { attr: ['#cal [data-date="2015-10-08"]', "aria-label", "Thursday, October 8, 2015, First available date"] },
    { attr: ['#cal [data-date="2015-10-13"]', "data-unavailable", "true"] },
    { attr: ['#cal [data-date="2015-10-10"]', "data-unavailable", "true"] },
    // Unavailable dates take focus but Enter selects nothing.
    { click: '#cal [data-date="2015-10-15"]' },
    { press: ['#cal [data-date="2015-10-15"]', "ArrowLeft"] },
    { key: "ArrowLeft" },
    { focused: '[data-date="2015-10-13"]' },
    { key: "Enter" },
    { attr: ['#cal [data-date="2015-10-15"]', "data-selected", "true"] },
    { attr: ['#cal [data-date="2015-10-13"]', "data-selected", null] },
    { click: '#cal [slot="next"]' },
    { expect: ["#cal .rv-Heading", "November 2015"] },
    { attr: ['#cal [slot="next"]', "disabled", ""] },
    { attr: ['#cal [data-date="2015-11-20"]', "aria-label", "Friday, November 20, 2015, Last available date"] },
    { attr: ['#cal [data-date="2015-11-23"]', "data-disabled", "true"] },
  ],
});
