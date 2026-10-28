// Server-target suite: the ui-docs `table-tanstack-table` demo SSR — TanStack row models (`@rivetjs/ui/table-tanstack`)
// render the grid-path ui Table on the server: headers from the column defs, first page (pageSize 4) in data order,
// `flexRender` cell templates (status Chip), sortable headers, pagination summary / links. The same render runs in the
// browser's adopt run (the component's sort / page signals start from the same values on both sides).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { TanstackTable } from "../../../apps/ui-docs/examples/table-tanstack-table/src/routes/index.tsx";

const text = (html: string) => html.replace(/<!--[^>]*-->/g, "").replace(/<[^>]+>/g, "|");
const cells = (html: string, tag: string) =>
  [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>(.*?)</${tag}>`, "gs"))].map((m) => text(m[1]!).replace(/\|+/g, " ").trim());

test("tanstack demo SSR: headers, first page, Chip cells, pagination", async () => {
  const html = await renderToString(() => <TanstackTable />);
  assert.match(html, /<table[^>]*role="grid"/);
  assert.match(html, /aria-label="TanStack Table example"/);
  const head = html.slice(html.indexOf("<thead"), html.indexOf("</thead>"));
  assert.deepEqual(cells(head, "th"), ["Name", "Role", "Status", "Email"]);
  assert.equal((head.match(/data-slot="table-sortable-column-header"/g) ?? []).length, 4);
  const body = html.slice(html.indexOf("<tbody"), html.indexOf("</tbody>"));
  const rows = [...body.matchAll(/<tr\b[^>]*>(.*?)<\/tr>/gs)].map((m) => m[1]!);
  assert.equal(rows.length, 4);
  assert.deepEqual(
    rows.map((r) => cells(r, "t[hd]")[0]),
    ["Kate Moore", "John Smith", "Sara Johnson", "Michael Brown"],
  );
  assert.match(rows[2]!, /data-slot="chip"[^>]*>[\s\S]*On Leave/);
  assert.match(text(html), /1\|* to \|*4\|* of \|*8\|* results/);
  assert.match(html, /data-slot="pagination-link"[^>]*aria-current="page"|aria-current="page"[^>]*data-slot="pagination-link"/);
});
