// collections/components.tsx: RAC collection parts in live (in-place) and build (collection) modes,
// server-rendered in resume mode.
import { test } from "vitest";
import assert from "node:assert/strict";
import { importModule, renderHtml } from "./server.ts";

const page = (body: string) =>
  importModule<{ Page: () => unknown }>(
    "collection-page.tsx",
    `import { Host, BuiltHost, Item, Sec, IdBranch } from "./tests/fixtures/collection-parts.tsx";\nimport { Collection } from "./collections/components.tsx";\nexport function Page() { return ${body}; }`,
  );

test("live mode renders parts in place; build mode collects ids, text and nesting", async () => {
  const { Page } = await page(`<Host><Item id="a">Alpha</Item><Sec id="s"><Item id="b">Beta</Item></Sec><Item>Gamma</Item></Host>`);
  const html = await renderHtml(() => Page());
  assert.match(html, /data-size="3"/);
  assert.match(html, /data-keys="a,s,b,\$\.0"/);
  assert.match(html, /data-texts="Alpha,,Gamma"/);
  assert.match(html, /<div role="option" data-key="a" data-level="0">Alpha<\/div>/);
  assert.match(html, /data-key="\$\.0" data-level="0">Gamma</);
  assert.match(html, /<section role="group" data-key="s"><div role="option" data-key="b" data-level="0" data-parent="s">Beta<\/div><\/section>/);
});

test("Collection items: id defaults to item.id, value to the item", async () => {
  const { Page } = await page(`<Host items={[{ id: "x", name: "X" }, { id: "y", name: "Y" }]}>{(item) => <Item>{item.name}</Item>}</Host>`);
  const html = await renderHtml(() => Page());
  assert.match(html, /data-keys="x,y"/);
  assert.match(html, /data-key="x"[^>]*>X</);
  assert.match(html, /data-key="y"[^>]*>Y</);
});

test("built collection renders node by node", async () => {
  const { Page } = await page(`<BuiltHost><Item id="a">A</Item><Item id="b">B</Item></BuiltHost>`);
  const html = await renderHtml(() => Page());
  assert.match(html, /data-key="a"[^>]*>A<\/div>.*data-key="b"[^>]*>B<\/div>/s);
});

test("live mode renders part children once (textValue never evaluates lazy children)", async () => {
  const { Page } = await importModule<{ Page: () => unknown }>(
    "collection-page-once.tsx",
    `import { LiveHost, Item, Sec, Probe } from "./tests/fixtures/collection-parts.tsx";\nexport function Page() { return <LiveHost><Item id="a"><Probe /></Item><Sec id="s"><Probe /><Item id="b">B</Item></Sec></LiveHost>; }`,
  );
  const { renders } = await importModule<{ renders: { count: number } }>(
    "collection-page-once-probe.tsx",
    `export { renders } from "./tests/fixtures/collection-parts.tsx";`,
  );
  renders.count = 0;
  const html = await renderHtml(() => Page());
  assert.equal(renders.count, 2);
  assert.equal(html.match(/<span>probe<\/span>/g)?.length, 2);
});

test("Collection: an item renderer without items renders nothing; a 0-arity thunk is content", async () => {
  const { Page } = await page(
    `<Host><Collection items={undefined}>{(item) => <Item>{String(item)}</Item>}</Collection><Collection>{() => <Item id="t">T</Item>}</Collection></Host>`.replace(
      "<Host>",
      "<Host>",
    ),
  );
  const html = await renderHtml(() => Page());
  assert.match(html, /data-keys="t"/);
  assert.doesNotMatch(html, />undefined</);
  assert.match(html, /data-key="t"[^>]*>T</);
});

test("Collection items: only the first part a row renders takes the item id (RAC addIdAndValue clones one element)", async () => {
  const { Page } = await page(
    `<Host items={[{ id: "x", name: "X" }, { id: "y", name: "Y" }]}>{(item) => <><Item>{item.name}</Item><Item>{"more " + item.name}</Item></>}</Host>`,
  );
  const html = await renderHtml(() => Page());
  assert.match(html, /data-keys="x,\$\.0,y,\$\.1"/);
  assert.match(html, /data-key="x"[^>]*>X</);
  assert.match(html, /data-key="\$\.0"[^>]*>more X</);
});

test("branch useChildren sees the item-default id; a static branch without id gets none (RAC useCachedChildren)", async () => {
  const { Page } = await page(`<Host items={[{ id: "x", name: "X" }]}>{() => <IdBranch />}</Host>`);
  const html = await renderHtml(() => Page());
  assert.match(html, /data-keys="x,x-child"/);
  const auto = await page(`<Host><IdBranch /></Host>`);
  const html2 = await renderHtml(() => auto.Page());
  assert.match(html2, /data-keys="\$\.0,undefined-child"/);
});

test("built nodes render without a generated id prop (RAC passes node.props as given)", async () => {
  const { Page } = await importModule<{ Page: () => unknown }>(
    "collection-page-idprop.tsx",
    `import { BuiltHost, IdProbe } from "./tests/fixtures/collection-parts.tsx";\nexport function Page() { return <BuiltHost><IdProbe /><IdProbe id="k" /></BuiltHost>; }`,
  );
  const html = await renderHtml(() => Page());
  assert.match(html, /<i data-id="none"><\/i>.*<i data-id="k"><\/i>/s);
});
