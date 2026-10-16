import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Table: dynamic content",
  summary: "Columns and rows from data (TableHeader columns, TableBody items, Row columns) plus a TableFooter total.",
  tags: ["table", "collections", "dynamic"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#invoices thead", "Payment Method"] },
    { attr: ["#invoices-status", "role", "columnheader"] },
    { expect: ["#invoices tbody tr[data-key='1']", "Website Design"] },
    { attr: ["#invoices tbody tr[data-key='1'] td:first-child", "role", "rowheader"] },
    { matches: "#invoices > tfoot[role=rowgroup] > tr[data-key=total]" },
    { expect: ["#invoices tfoot", "$2,350"] },
    { click: "#add-row" },
    { expect: ["#invoices tbody tr[data-key='4']", "New Invoice"] },
    { expect: ["#invoices tfoot", "$2,600"] },
    { click: "#show-status" },
    { absent: "#invoices-status" },
    { expect: ["#invoices tbody tr[data-key='1']", "Credit Card"] },
  ],
});
