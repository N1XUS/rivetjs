// Server-target suite: `ItemMorph` SSR (Rivet addition): items carry the morph attributes (`data-rv-morph`,
// `data-rv-long-press`), the panel renders only its `display: contents` anchor (nothing before a trigger), no script needed.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { ListBox } from "../src/components/list-box/index.ts";
import { ItemMorph, itemMorphProps, useItemMorph } from "../src/components/item-morph/index.ts";

const Fixture = (props: { trigger?: "doubleClick" | "none" }) => {
  const m = useItemMorph({ trigger: props.trigger });
  return (
    <>
      <ListBox aria-label="Contacts">
        <ListBox.Item id="ada" textValue="Ada" {...itemMorphProps(m)}>
          Ada
        </ListBox.Item>
      </ListBox>
      <ItemMorph morph={m}>{(k) => <p>Preview {k()}</p>}</ItemMorph>
    </>
  );
};

test("item-morph SSR: item attributes, anchor only", async () => {
  const html = await renderToString(() => <Fixture />);
  assert.match(html, /role="option"[^>]*/);
  assert.match(html, /data-rv-morph="[^"]+"/);
  assert.match(html, /data-rv-long-press=""/);
  assert.match(html, /data-rv-item-morph-anchor=""/);
  assert.doesNotMatch(html, /data-morph-surface/);
  assert.doesNotMatch(html, /Preview/);
});

test("item-morph SSR: doubleClick / none triggers carry no long-press mark", async () => {
  for (const trigger of ["doubleClick", "none"] as const) {
    const html = await renderToString(() => <Fixture trigger={trigger} />);
    assert.match(html, /data-rv-morph="[^"]+"/);
    assert.doesNotMatch(html, /data-rv-long-press/);
  }
});
