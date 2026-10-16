// `render` prop on the server (resume mode): the replaced element is in the markup, the default one is not.
import { test } from "vitest";
import assert from "node:assert/strict";
import { importModule, renderHtml } from "./server.ts";

const src = `
import { Button } from "../button/index.tsx";
import { Heading } from "../heading/index.tsx";
export function Page() {
  return (
    <div>
      <Button data-testid="b" render={(props) => <a {...props} href="#x" />}>go</Button>
      <Heading level={2} render={(props) => <div {...props} role="heading" />}>h</Heading>
    </div>
  );
}
`;

test("Button / Heading with render serialize the replaced element", async () => {
  const { Page } = await importModule<{ Page(): never }>("render-fixture.tsx", src);
  const html = await renderHtml(Page as never);
  assert.ok(html.includes("<a "), html);
  assert.ok(!html.includes("<button"), html);
  assert.ok(html.includes("go"), html);
  assert.ok(html.includes('role="heading"') && !html.includes("<h2"), html);
});

// SSR HTML parity: `render={(p) => <div {...p} />}` serializes the same markup as the default `<div>` (hidden a11y nodes,
// prompts, hidden inputs and siblings included). Generated ids / resume ids are masked.
const parity = (name: string, body: string) => {
  const mk = (renderProp: string) => `
import { Calendar, RangeCalendar } from "../calendar/index.tsx";
import { DateField, DateInput, DateSegment } from "../date-field/index.tsx";
import { DatePicker, DateRangePicker } from "../date-picker/index.tsx";
import { Group } from "../group/index.tsx";
import { Button } from "../button/index.tsx";
import { Label } from "../label/index.tsx";
import { Popover } from "../popover/index.tsx";
import { Dialog } from "../dialog/index.tsx";
export function Page() {
  return (${body.replaceAll("RENDER", renderProp)});
}
`;
  test(`${name}: render path SSR HTML equals the default`, async () => {
    // Markup only (the resume manifest differs: the render closure adds a symbol); ids, resume record numbers and markers masked.
    const mask = (s: string) =>
      s
        .split("<script")[0]!
        .replace(/\brv[a-z0-9]{1,4}\b/g, "<id>")
        .replace(/ data-r="\d+"/g, "")
        .replace(/<!--r?\d*\[?-->|<!--\/?\]?-->/g, "<!--m-->");
    const def = await importModule<{ Page(): never }>(`render-parity-${name}-def.tsx`, mk(""));
    const rnd = await importModule<{ Page(): never }>(`render-parity-${name}-render.tsx`, mk("render={(p) => <div {...p} />}"));
    const a = mask(await renderHtml(rnd.Page as never));
    const b = mask(await renderHtml(def.Page as never));
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    assert.ok(a === b, `first difference at ${i}\nrender : …${a.slice(Math.max(0, i - 80), i + 160)}\ndefault: …${b.slice(Math.max(0, i - 80), i + 160)}`);
  });
};
// No fixed dates: a CalendarDate capture is not serializable on a resumed page (the default is today, stable within a run).
const D = "";
parity("calendar", `<Calendar aria-label="c" ${D} RENDER />`);
parity("range-calendar", `<RangeCalendar aria-label="c" RENDER />`);
parity("date-field", `<DateField aria-label="d" name="d" ${D} RENDER><DateInput>{(s) => <DateSegment segment={s} />}</DateInput></DateField>`);
parity(
  "date-picker",
  `<DatePicker aria-label="d" name="d" ${D} RENDER><Group><DateInput>{(s) => <DateSegment segment={s} />}</DateInput><Button>o</Button></Group><Popover><Dialog><Calendar /></Dialog></Popover></DatePicker>`,
);

// Harness memory bound: a module imports its `.tsx` dependencies by file URL, so its emitted source stays its own size
// (inlining each dependency as a nested data URL grew date-picker to 12 MB per URL and the run past 4 GB).
test("server harness: a deep module graph emits file URLs of bounded size", async () => {
  const { serverModule } = await import("./server.ts");
  const { readFile } = await import("node:fs/promises");
  const url = await serverModule("date-picker/index.tsx");
  assert.ok(url.startsWith("file:"), url.slice(0, 40));
  const code = await readFile(new URL(url), "utf8");
  assert.ok(!code.includes("data:text/javascript"), "dependency inlined as a data URL");
  assert.ok(code.length < 200_000, `date-picker server module is ${code.length} chars`);
});
