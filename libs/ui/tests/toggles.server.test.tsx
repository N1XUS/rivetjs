// Server-target suite: `Checkbox` / `CheckboxGroup` / `Radio` / `RadioGroup` / `Switch` / `SwitchGroup` SSR markup (upstream checkbox /
// switch `ssr` cases + classes, data-slots, selected / disabled / indeterminate state, default indicators; Checkbox `aria-describedby` only for a rendered Description;
// T21 shorthand (`label` / `description` / `items`) = the same HTML as the compound form).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Checkbox, checkboxVariants } from "../src/components/checkbox/index.ts";
import { CheckboxGroup, checkboxGroupVariants } from "../src/components/checkbox-group/index.ts";
import { Radio, radioVariants } from "../src/components/radio/index.ts";
import { RadioGroup, radioGroupVariants } from "../src/components/radio-group/index.ts";
import { Switch, switchVariants } from "../src/components/switch/index.ts";
import { SwitchGroup, switchGroupVariants } from "../src/components/switch-group/index.ts";
import { Label } from "../src/components/label/index.ts";
import { assertSameHtml } from "./same-html.ts";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("checkbox upstream SSR: renders without hydration mismatch when defaultSelected", async () => {
  const html = await renderToString(() => (
    <Checkbox defaultSelected>
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        <Label>Accept terms</Label>
      </Checkbox.Content>
    </Checkbox>
  ));
  assert.match(html, /data-slot="checkbox"/);
  assert.match(html, /data-selected="true"/);
  const slots = checkboxVariants({});
  for (const c of [slots.base(), slots.content(), slots.control(), slots.indicator()]) assert.match(html, new RegExp(`class="${esc(c)}"`));
  assert.match(html, /<label[^>]*data-slot="checkbox-content"/);
  assert.match(html, /<span[^>]*data-slot="label"[^>]*>Accept terms<\/span>/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /\bchecked\b/);
  assert.match(html, /data-slot="checkbox-default-indicator--checkmark"/);
  assert.match(html, /stroke-dashoffset="48"/);
});

test("checkbox SSR: indeterminate dash, disabled, variant + class", async () => {
  const html = await renderToString(() => (
    <Checkbox class="mine" isDisabled isIndeterminate variant="secondary">
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        Terms
      </Checkbox.Content>
    </Checkbox>
  ));
  assert.match(html, /data-indeterminate="true"/);
  assert.match(html, /data-disabled="true"/);
  assert.match(html, /data-slot="checkbox-default-indicator--indeterminate"/);
  assert.doesNotMatch(html, /checkbox-default-indicator--checkmark/);
  assert.match(html, new RegExp(`class="${esc(checkboxVariants({ variant: "secondary" }).base({ className: "mine" }))}"`));
});

test("checkbox-group SSR: group role + class + label; items inherit the variant", async () => {
  const html = await renderToString(() => (
    <CheckboxGroup defaultValue={["a"]} name="g" variant="secondary">
      <Label>Pick</Label>
      <Checkbox value="a">
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          A
        </Checkbox.Content>
      </Checkbox>
      <Checkbox value="b">
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          B
        </Checkbox.Content>
      </Checkbox>
    </CheckboxGroup>
  ));
  assert.match(html, /role="group"/);
  assert.match(html, /data-slot="checkbox-group"/);
  assert.match(html, new RegExp(`class="${esc(checkboxGroupVariants({ variant: "secondary" }))}"`));
  assert.equal(html.match(new RegExp(`class="${esc(checkboxVariants({ variant: "secondary" }).base())}"`, "g"))!.length, 2);
  assert.equal(html.match(/data-selected="true"/g)!.length, 2); // selected field + its content label
  assert.equal(html.match(/name="g"/g)!.length, 2);
});

test("radio-group SSR: radiogroup role, radio classes, selected item", async () => {
  const html = await renderToString(() => (
    <RadioGroup defaultValue="b" name="plan" variant="secondary">
      <Label>Plan</Label>
      <Radio value="a">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          Basic
        </Radio.Content>
      </Radio>
      <Radio value="b">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          Premium
        </Radio.Content>
      </Radio>
    </RadioGroup>
  ));
  assert.match(html, /role="radiogroup"/);
  assert.match(html, /data-slot="radio-group"/);
  assert.match(html, new RegExp(`class="${esc(radioGroupVariants({ variant: "secondary" }))}"`));
  const slots = radioVariants();
  for (const c of [slots.base(), slots.content(), slots.control(), slots.indicator()]) assert.match(html, new RegExp(`class="${esc(c)}"`));
  assert.equal(html.match(/type="radio"/g)!.length, 2);
  assert.equal(html.match(/data-selected="true"/g)!.length, 2); // selected field + its content label
});

test("switch upstream SSR: renders without hydration mismatch when defaultSelected", async () => {
  const html = await renderToString(() => (
    <Switch defaultSelected>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Label>Enable notifications</Label>
      </Switch.Content>
    </Switch>
  ));
  assert.match(html, /data-slot="switch"/);
  assert.match(html, /data-selected="true"/);
  assert.match(html, /role="switch"/);
  const slots = switchVariants({});
  for (const c of [slots.base(), slots.content(), slots.control(), slots.thumb()]) assert.match(html, new RegExp(`class="${esc(c)}"`));
});

test("switch-group SSR: orientation classes + items wrapper; switch size", async () => {
  const html = await renderToString(() => (
    <SwitchGroup orientation="horizontal">
      <Switch size="lg">
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb>
              <Switch.Icon>
                <i />
              </Switch.Icon>
            </Switch.Thumb>
          </Switch.Control>
          Wifi
        </Switch.Content>
      </Switch>
    </SwitchGroup>
  ));
  const g = switchGroupVariants({ orientation: "horizontal" });
  assert.match(html, new RegExp(`class="${esc(g.base())}"[^>]*data-slot="switch-group"|data-slot="switch-group"[^>]*class="${esc(g.base())}"`));
  assert.match(html, new RegExp(`class="${esc(g.items())}"`));
  assert.match(html, /data-slot="switch-group-items"/);
  assert.match(html, new RegExp(`class="${esc(switchVariants({ size: "lg" }).base())}"`));
  assert.match(html, /data-slot="switch-icon"/);
});

test("checkbox SSR: aria-describedby only for a rendered Description (no IDREF to a missing part)", async () => {
  const { Description } = await import("../src/components/description/index.ts");
  const bare = await renderToString(() => (
    <Checkbox id="signup-terms" name="terms">
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        I agree
      </Checkbox.Content>
    </Checkbox>
  ));
  assert.doesNotMatch(bare, /aria-describedby/);
  const described = await renderToString(() => (
    <Checkbox id="news" name="news">
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        News
      </Checkbox.Content>
      <Description>Once a month</Description>
    </Checkbox>
  ));
  const ref = /<input[^>]* aria-describedby="([^"]+)"/.exec(described)?.[1];
  assert.ok(ref, described);
  assert.match(described, new RegExp(` id="${esc(ref!)}"`));
});

test("shorthand SSR (T21): Checkbox / Switch / Radio label + description and group items render the compound form's HTML", async () => {
  const { Description } = await import("../src/components/description/index.ts");
  const { FieldError } = await import("../src/components/field-error/index.ts");
  await assertSameHtml(
    () => <Checkbox id="a" label="News" description="Monthly" />,
    () => (
      <Checkbox id="a">
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          News
        </Checkbox.Content>
        <Description>Monthly</Description>
      </Checkbox>
    ),
  );
  await assertSameHtml(
    () => <Switch id="b" label="Dark" />,
    () => (
      <Switch id="b">
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Dark
        </Switch.Content>
      </Switch>
    ),
  );
  await assertSameHtml(
    () => (
      <RadioGroup
        id="c"
        label="Tier"
        description="Billing"
        errorMessage="Pick one"
        items={[
          { value: "free", label: "Free" },
          { value: "pro", label: "Pro", description: "Teams", isDisabled: true },
        ]}
      />
    ),
    () => (
      <RadioGroup id="c">
        <Label>Tier</Label>
        <Description>Billing</Description>
        <Radio value="free">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Free
          </Radio.Content>
        </Radio>
        <Radio value="pro" isDisabled>
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Pro
          </Radio.Content>
          <Description>Teams</Description>
        </Radio>
        <FieldError>Pick one</FieldError>
      </RadioGroup>
    ),
  );
  await assertSameHtml(
    () => <CheckboxGroup id="d" label="Topics" items={[{ value: "rust", label: "Rust" }]} />,
    () => (
      <CheckboxGroup id="d">
        <Label>Topics</Label>
        <Checkbox value="rust">
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            Rust
          </Checkbox.Content>
        </Checkbox>
      </CheckboxGroup>
    ),
  );
});

test("shorthand precedence (T21): explicit children win over label / description / items (dev warning)", async () => {
  const { DEV } = await import("#dev");
  const warns: string[] = [];
  const warn = console.warn;
  console.warn = (m: string) => void warns.push(m);
  try {
    const radios = () => (
      <Radio value="a">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          A
        </Radio.Content>
      </Radio>
    );
    await assertSameHtml(
      () => (
        <RadioGroup id="p" label="Ignored" description="Ignored too" items={[{ value: "x", label: "X" }]}>
          {radios()}
        </RadioGroup>
      ),
      () => <RadioGroup id="p">{radios()}</RadioGroup>,
    );
    const content = () => (
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        Own
      </Checkbox.Content>
    );
    await assertSameHtml(
      () => (
        <Checkbox id="q" label="Ignored">
          {content()}
        </Checkbox>
      ),
      () => <Checkbox id="q">{content()}</Checkbox>,
    );
    if (DEV) {
      assert.ok(warns.includes("[rivet ui] RadioGroup: children and label/items both given; children win"), warns.join("\n"));
      assert.ok(warns.includes("[rivet ui] Checkbox: children and label/items both given; children win"), warns.join("\n"));
    }
    // Children alone, or the shorthand alone: no warning.
    warns.length = 0;
    await renderToString(() => <RadioGroup id="r">{radios()}</RadioGroup>);
    await renderToString(() => <RadioGroup id="s" label="Tier" items={[{ value: "x", label: "X" }]} />);
    assert.deepEqual(warns, []);
  } finally {
    console.warn = warn;
  }
});
