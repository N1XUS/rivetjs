import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Table collection and sorting",
  summary: "A TableCollection from TableHeader, Column, TableBody, Row and Cell, sorted with nextSortDescriptor; aria-sort from ariaSort.",
  tags: ["collections", "table"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#row-header", "rowHeaderColumnKeys: name"] },
    { attr: ["#col-name", "aria-sort", "none"] },
    { expect: ["#rows tr:nth-child(1)", "Mars"] },
    { click: "#col-name button" },
    { attr: ["#col-name", "aria-sort", "ascending"] },
    { expect: ["#rows tr:nth-child(1)", "Earth"] },
    // The same column again flips the direction.
    { click: "#col-name button" },
    { attr: ["#col-name", "aria-sort", "descending"] },
    { expect: ["#rows tr:nth-child(1)", "Mars"] },
    // A new column starts ascending.
    { click: "#col-moons button" },
    { attr: ["#col-moons", "aria-sort", "ascending"] },
    { attr: ["#col-name", "aria-sort", "none"] },
    { expect: ["#rows tr:nth-child(3)", "Jupiter95"] },
  ],
});
