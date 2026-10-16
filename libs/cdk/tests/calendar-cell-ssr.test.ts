// Resumable server HTML of a CalendarCell wrapped like ui `Calendar.Cell` (live props forwarded through `splitProps` +
// spread) whose children function captures the cell's `date` (a CalendarDate): the cell's class / style binding captured
// one live view of class + style + children, so the unserializable children closure failed the render — "Cannot resume
// …CalendarCell$N: capture #2 CalendarDate instance is not serializable" (RESUME-BUGS 2026-10-09, ui-docs
// calendar-with-indicators prerender). `renderPropsOf` now passes one live view per key.
import { test } from "vitest";
import assert from "node:assert/strict";
import { importModule, renderHtml } from "./server.ts";

test("a live CalendarCell whose children capture its date renders resumably", async () => {
  const { Page } = await importModule<{ Page: () => unknown }>(
    "calendar-cell-ssr.tsx",
    `import { Calendar, CalendarGrid, CalendarGridBody, CalendarCell } from "@rivetjs/cdk/calendar";
import { splitProps } from "@rivetjs/runtime/props";
import { CalendarDate } from "@rivetjs/cdk/date";
const marked = [3, 7];
function Cell(props: any) {
  const [local, rest] = splitProps(props, ["children", "class"]);
  return <CalendarCell data-slot="calendar-cell" {...rest} class="cell">{local.children}</CalendarCell>;
}
export function Page() {
  return (
    <Calendar aria-label="Date" defaultValue={new CalendarDate(2026, 10, 9)}>
      <CalendarGrid>
        <CalendarGridBody>
          {(date) => <Cell date={date}>{({ formattedDate }) => <>{formattedDate}{marked.includes(date.day) && <i class="dot" />}</>}</Cell>}
        </CalendarGridBody>
      </CalendarGrid>
    </Calendar>
  );
}`,
  );
  const html = await renderHtml(() => Page());
  assert.equal((html.match(/<i class="dot"><\/i>/g) ?? []).length, 2);
  assert.match(html, /class="cell"/);
});
