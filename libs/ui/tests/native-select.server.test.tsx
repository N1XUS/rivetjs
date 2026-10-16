// Server-target suite: `NativeSelect` (Rivet addition; feature set inspired by HeroUI Pro's public docs, independent implementation)
// SSR — field root (cdk TextField) + real `<select>` inside the positioned trigger wrapper, BEM classes + data-slot per part,
// variant / fullWidth modifiers, selected option from `defaultValue` / a value signal, label `for`, description id, optgroups,
// disabled options, custom / hidden indicator, `aria-describedby` only for a rendered Description; T21 shorthand (`label` / `items`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { signal } from "@rivetjs/reactivity";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { NativeSelect } from "../src/components/native-select/index.ts";
import { Label } from "../src/components/label/index.ts";
import { Description } from "../src/components/description/index.ts";
import { assertSameHtml } from "./same-html.ts";

test("native-select SSR: field, trigger wrapper, select, default indicator, selected option", async () => {
  const html = await renderToString(() => (
    <NativeSelect defaultValue="b" name="fruit">
      <Label>Fruit</Label>
      <NativeSelect.Trigger>
        <NativeSelect.Option value="a">Apple</NativeSelect.Option>
        <NativeSelect.Option value="b">Banana</NativeSelect.Option>
        <NativeSelect.Option value="c" disabled>
          Cherry
        </NativeSelect.Option>
      </NativeSelect.Trigger>
      <Description>Pick one</Description>
    </NativeSelect>
  ));
  const root = /<div[^>]*data-slot="native-select"[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(root, /class="native-select native-select--primary"/);
  assert.match(html, /<div class="native-select__trigger" data-slot="native-select-trigger">(?:<!--[^>]*-->)*<select/);
  const select = /<select[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(select, /class="native-select__select"/);
  assert.match(select, /data-slot="native-select-select"/);
  assert.match(select, /name="fruit"/);
  const id = /id="([^"]+)"/.exec(select)?.[1];
  assert.ok(html.includes(`for="${id}"`));
  assert.match(select, /aria-describedby="[^"]+"/);
  assert.match(html, /<option[^>]*value="b"[^>]*selected/);
  assert.doesNotMatch(/<option[^>]*value="a"[^>]*>/.exec(html)?.[0] ?? "", /selected/);
  assert.match(/<option[^>]*value="c"[^>]*>/.exec(html)?.[0] ?? "", /disabled/);
  assert.match(html, /class="native-select__option"/);
  assert.match(
    html,
    /<\/select>(?:<!--[^>]*-->)*<span aria-hidden="true" class="native-select__indicator morph-chevron" data-slot="native-select-default-indicator"/,
  );
});

test("native-select SSR: secondary + fullWidth, value signal, optgroups, custom / hidden indicator", async () => {
  const value = signal("y");
  const html = await renderToString(() => (
    <>
      <NativeSelect variant="secondary" fullWidth value={value} aria-label="A" id="s1">
        <NativeSelect.Trigger wrapperClass="wrap" indicator={<NativeSelect.Indicator class="ind">v</NativeSelect.Indicator>}>
          <NativeSelect.OptGroup label="G">
            <NativeSelect.Option value="x">X</NativeSelect.Option>
            <NativeSelect.Option value="y">Y</NativeSelect.Option>
          </NativeSelect.OptGroup>
        </NativeSelect.Trigger>
      </NativeSelect>
      <NativeSelect aria-label="B" id="s2">
        <NativeSelect.Trigger indicator={null}>
          <NativeSelect.Option value="x">X</NativeSelect.Option>
        </NativeSelect.Trigger>
      </NativeSelect>
    </>
  ));
  const [first, second] = html.split('id="s2"');
  assert.match(first!, /class="native-select native-select--full-width native-select--secondary"/);
  assert.match(first!, /class="native-select__trigger native-select__trigger--full-width wrap"/);
  assert.match(first!, /<optgroup[^>]*label="G"[^>]*class="native-select__optgroup"|<optgroup[^>]*class="native-select__optgroup"[^>]*label="G"/);
  assert.match(first!, /<option[^>]*value="y"[^>]*selected/);
  assert.match(first!, /<span aria-hidden="true" class="native-select__indicator ind" data-slot="native-select-indicator">v<\/span>/);
  assert.doesNotMatch(second!, /native-select__indicator/);
});

test("native-select SSR: no aria-describedby without a Description (no IDREF to a missing part); with one it resolves", async () => {
  const bare = await renderToString(() => (
    <NativeSelect defaultValue="a">
      <Label>Time zone</Label>
      <NativeSelect.Trigger>
        <NativeSelect.Option value="a">Lisbon</NativeSelect.Option>
      </NativeSelect.Trigger>
    </NativeSelect>
  ));
  assert.doesNotMatch(bare, /aria-describedby/);
  const described = await renderToString(() => (
    <NativeSelect defaultValue="a">
      <Label>Time zone</Label>
      <NativeSelect.Trigger>
        <NativeSelect.Option value="a">Lisbon</NativeSelect.Option>
      </NativeSelect.Trigger>
      <Description>Used for order times</Description>
    </NativeSelect>
  ));
  const ref = /<select[^>]* aria-describedby="([^"]+)"/.exec(described)?.[1];
  assert.ok(ref, described);
  assert.match(described, new RegExp(` id="${ref}"`));
});

test("shorthand SSR (T21): NativeSelect label + items + description = the compound form", async () => {
  await assertSameHtml(
    () => (
      <NativeSelect
        defaultValue="b"
        label="Tea"
        description="Brewed fresh"
        items={[
          { value: "a", label: "Green" },
          { value: "b", label: "Oolong", isDisabled: true },
        ]}
      />
    ),
    () => (
      <NativeSelect defaultValue="b">
        <Label>Tea</Label>
        <NativeSelect.Trigger>
          <NativeSelect.Option value="a">Green</NativeSelect.Option>
          <NativeSelect.Option value="b" disabled>
            Oolong
          </NativeSelect.Option>
        </NativeSelect.Trigger>
        <Description>Brewed fresh</Description>
      </NativeSelect>
    ),
  );
});
