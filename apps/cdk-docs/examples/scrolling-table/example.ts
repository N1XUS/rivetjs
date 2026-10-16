import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtual scroll: table rows",
  summary: "CdkVirtualForOf under a native <tbody>: only the rendered range of <tr> rows exists, translated with the content wrapper; trackBy keys rows by id.",
  tags: ["scrolling", "virtual scroll", "table"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: '#orders tbody tr[data-id="o-0"]' },
    { absent: '#orders tbody tr[data-id="o-200"]' },
    { press: ["#orders", "End"] },
    { matches: '#orders tbody tr[data-id="o-1999"]' },
    { absent: '#orders tbody tr[data-id="o-0"]' },
    { expect: ['#orders tbody tr[data-id="o-1999"] td.num', "1999"] },
  ],
});
