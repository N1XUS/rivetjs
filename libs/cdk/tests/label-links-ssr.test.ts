// Server HTML of label / description links that the first server render must already carry (CDK-PINS 2026-10-12:
// TagList labelledby via markSlotRendered, SwitchField describedby via its slot probe, Input own id merged into the
// field Label's `for` during the probe, DatePicker segment labelling). Resume fuzz pins covered these before; these
// cases pin them in the node project.
import { test } from "vitest";
import assert from "node:assert/strict";
import { importModule, renderHtml } from "./server.ts";

/** The page markup without the resume state / loader scripts. */
const body = (html: string) => html.replace(/<script[\s\S]*$/, "");
const tag = (html: string, re: RegExp) => re.exec(html)?.[0] ?? assert.fail(`${re} not in ${html}`);
const attr = (el: string, name: string) => new RegExp(` ${name}="([^"]*)"`).exec(el)?.[1];

const page = (name: string, imports: string, jsx: string) =>
  importModule<{ Page: () => unknown }>(name, `${imports}\nexport function Page() { return ${jsx}; }`);

test("TagList with aria-label and a visible Label: aria-labelledby names the Label (markSlotRendered)", async () => {
  const { Page } = await page(
    "label-links-tags.tsx",
    `import { Tag, TagGroup, TagList } from "../tag-group/index.tsx";\nimport { Label } from "../label/index.tsx";`,
    `<TagGroup id="tg" aria-label="Tags"><Label>Categories</Label><TagList><Tag id="a">A</Tag><Tag id="b">B</Tag></TagList></TagGroup>`,
  );
  const html = body(await renderHtml(() => Page()));
  const label = tag(html, /<span[^>]*class="rv-Label"[^>]*>|<label[^>]*>/);
  const labelId = attr(label, "id");
  assert.ok(labelId, label);
  const grid = tag(html, /<div[^>]* role="grid"[^>]*>/);
  assert.ok((attr(grid, "aria-labelledby") ?? "").split(" ").includes(labelId), grid);
});

test("SwitchField: the input's aria-describedby names its description on the server (slot probe)", async () => {
  const { Page } = await page(
    "label-links-switch.tsx",
    `import { SwitchButton, SwitchField } from "../switch/index.tsx";\nimport { Text } from "../text/index.tsx";`,
    `<SwitchField id="sw"><SwitchButton>Wi-Fi</SwitchButton><Text slot="description">Turns the radio on.</Text></SwitchField>`,
  );
  const html = body(await renderHtml(() => Page()));
  const description = tag(html, /<[a-z]+[^>]* slot="description"[^>]*>|<span[^>]*>Turns the radio on\./);
  const descriptionId = attr(description, "id") ?? tag(html, /<[a-z]+[^>]* id="([^"]+)"[^>]*>Turns the radio on\./).match(/ id="([^"]+)"/)![1];
  const input = tag(html, /<input[^>]*>/);
  assert.ok((attr(input, "aria-describedby") ?? "").split(" ").includes(descriptionId!), `${input}\n${html}`);
});

test("TextField with <Input id>: the Label's for is the Input's own id (merged during the probe)", async () => {
  const { Page } = await page(
    "label-links-input.tsx",
    `import { TextField } from "../text-field/index.tsx";\nimport { Input } from "../input/index.tsx";\nimport { Label } from "../label/index.tsx";`,
    `<TextField><Label>Name</Label><Input id="own-input" /></TextField>`,
  );
  const html = body(await renderHtml(() => Page()));
  const label = tag(html, /<label[^>]*>/);
  const input = tag(html, /<input[^>]*>/);
  assert.equal(attr(input, "id"), "own-input", input);
  assert.equal(attr(label, "for"), "own-input", label);
  assert.ok((attr(input, "aria-labelledby") ?? attr(label, "id") ?? "").length > 0, input);
});

test("DatePicker: each segment is labelled by the picker Label (aria-label `<segment>, ` + aria-labelledby)", async () => {
  const { Page } = await page(
    "label-links-date-picker.tsx",
    `import { DatePicker } from "../date-picker/index.tsx";
import { DateInput, DateSegment } from "../date-field/index.tsx";
import { Group } from "../group/index.tsx";
import { Button } from "../button/index.tsx";
import { Label } from "../label/index.tsx";
import { Popover } from "../popover/index.tsx";
import { Dialog } from "../dialog/index.tsx";
import { Calendar } from "../calendar/index.tsx";`,
    `<DatePicker name="d"><Label>Event date</Label><Group><DateInput>{(s) => <DateSegment segment={s} />}</DateInput><Button>o</Button></Group><Popover><Dialog><Calendar /></Dialog></Popover></DatePicker>`,
  );
  const html = body(await renderHtml(() => Page()));
  const labelId = attr(tag(html, /<(?:label|span)[^>]*>Event date/), "id");
  assert.ok(labelId, html);
  const segments = [...html.matchAll(/<[a-z]+[^>]* role="spinbutton"[^>]*>/g)].map((m) => m[0]);
  assert.ok(segments.length >= 3, html);
  for (const seg of segments) {
    const name = attr(seg, "data-type") ?? "";
    assert.equal(attr(seg, "aria-label"), `${name}, `, seg);
    const ids = (attr(seg, "aria-labelledby") ?? "").split(" ");
    assert.ok(ids.includes(labelId!), seg);
    assert.ok(ids.includes(attr(seg, "id")!), seg);
  }
});

test("TextField with <TextArea id>: the Label's for is the TextArea's own id (merged during the probe)", async () => {
  const { Page } = await page(
    "label-links-textarea.tsx",
    `import { TextField } from "../text-field/index.tsx";\nimport { TextArea } from "../text-area/index.tsx";\nimport { Label } from "../label/index.tsx";`,
    `<TextField><Label>Bio</Label><TextArea id="own-area" /></TextField>`,
  );
  const html = body(await renderHtml(() => Page()));
  assert.equal(attr(tag(html, /<textarea[^>]*>/), "id"), "own-area", html);
  assert.equal(attr(tag(html, /<label[^>]*>/), "for"), "own-area", html);
});
