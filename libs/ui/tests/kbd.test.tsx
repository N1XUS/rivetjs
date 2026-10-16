// DOM-target suite: `Kbd` (upstream kbd tests ported): parts, variant slot classes via context, key → abbr title/symbol maps.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { Kbd, KbdAbbr, KbdContent, kbdKeysMap, kbdKeysLabelMap, kbdVariants } = await import("../src/components/kbd/index.ts");

test("kbd: root + abbr + content markup, class merge", () => {
  const r = render(() => (
    <Kbd class="ml-2">
      <Kbd.Abbr keyValue="command" />
      <Kbd.Content>K</Kbd.Content>
    </Kbd>
  ));
  assert.equal(r.html(), '<kbd class="kbd ml-2"><abbr class="kbd__abbr" title="Command">⌘</abbr><span class="kbd__content">K</span></kbd>');
  r.unmount();
});

test("kbd: variant reaches the root class (kbd--light); parts outside a Kbd get only their class", () => {
  const r = render(() => (
    <Kbd variant="light">
      <Kbd.Content>x</Kbd.Content>
    </Kbd>
  ));
  assert.equal(r.container.firstElementChild?.className, "kbd kbd--light");
  r.unmount();
  const o = render(() => (
    <div>
      <KbdAbbr keyValue="shift" class="a" />
      <KbdContent class="b">y</KbdContent>
    </div>
  ));
  assert.equal(o.html(), '<div><abbr class="a" title="Shift">⇧</abbr><span class="b">y</span></div>');
  o.unmount();
});

test("kbd: keyValue → abbr title + symbol matches kbd.constants for every key", () => {
  const keys = Object.keys(kbdKeysMap) as (keyof typeof kbdKeysMap)[];
  assert.equal(keys.length, 22);
  const r = render(() => (
    <Kbd>
      {keys.map((k) => (
        <Kbd.Abbr keyValue={k} />
      ))}
    </Kbd>
  ));
  const abbrs = Array.from(r.container.querySelectorAll("abbr"));
  assert.equal(abbrs.length, keys.length);
  keys.forEach((k, i) => {
    assert.equal(abbrs[i].getAttribute("title"), kbdKeysLabelMap[k]);
    assert.equal(abbrs[i].textContent, kbdKeysMap[k]);
  });
  r.unmount();
  assert.equal(kbdVariants().base(), "kbd");
});

test("kbd: ref forwarded on root, abbr and content", () => {
  let k: Element | undefined;
  let a: Element | undefined;
  const r = render(() => (
    <Kbd ref={(e: Element) => (k = e)}>
      <Kbd.Abbr keyValue="alt" ref={(e: Element) => (a = e)} />
    </Kbd>
  ));
  assert.equal(k?.tagName, "KBD");
  assert.equal(a?.tagName, "ABBR");
  r.unmount();
});
