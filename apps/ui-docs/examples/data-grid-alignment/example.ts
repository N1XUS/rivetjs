import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid: Alignment",
  summary: "Column `align` (`center`, `end`) lines up header and cells; `verticalAlign` places short cells against a wrapped one: top, middle or bottom.",
  tags: ["data-grid"],
  status: "experimental",
  frame: { height: 360, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "[data-vertical-align=middle]" },
    { click: "[aria-label='Vertical alignment'] [role=radio]:nth-of-type(1)" },
    { matches: "[data-vertical-align=top]" },
    { click: "[aria-label='Vertical alignment'] [role=radio]:nth-of-type(3)" },
    { matches: "[data-vertical-align=bottom]" },
    { matches: "tbody tr[data-key='1'] [data-column=amount][style*='text-align: end']" },
  ],
});
