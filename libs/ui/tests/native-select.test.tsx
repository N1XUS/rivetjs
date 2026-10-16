// DOM-target suite: `NativeSelect` (Rivet addition; feature set inspired by HeroUI Pro's public docs, independent implementation) on
// happy-dom: compound statics + variants, `change` updates a two-way value signal + `onChange`, a signal write selects the option,
// invalid state + FieldError, disabled field, live `variant` restyles in place.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { NativeSelect, NativeSelectRoot, NativeSelectTrigger, NativeSelectIndicator, NativeSelectOption, NativeSelectOptGroup, nativeSelectVariants } =
  await import("../src/components/native-select/index.ts");
const { Label } = await import("../src/components/label/index.ts");
const { FieldError } = await import("../src/components/field-error/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 0));

test("native-select: compound statics + variants", () => {
  assert.equal(NativeSelect, NativeSelectRoot);
  assert.equal(NativeSelect.Root, NativeSelectRoot);
  assert.equal(NativeSelect.Trigger, NativeSelectTrigger);
  assert.equal(NativeSelect.Indicator, NativeSelectIndicator);
  assert.equal(NativeSelect.Option, NativeSelectOption);
  assert.equal(NativeSelect.OptGroup, NativeSelectOptGroup);
  assert.equal(nativeSelectVariants().base(), "native-select native-select--primary");
  assert.equal(nativeSelectVariants({ variant: "secondary", fullWidth: true }).trigger(), "native-select__trigger native-select__trigger--full-width");
});

test("native-select: change updates the value signal + onChange; a signal write selects the option", async () => {
  const value = signal("b");
  const calls: string[] = [];
  const r = render(() => (
    <NativeSelect value={value} onChange={(v: string) => calls.push(v)}>
      <Label>Fruit</Label>
      <NativeSelect.Trigger>
        <NativeSelect.Option value="a">Apple</NativeSelect.Option>
        <NativeSelect.Option value="b">Banana</NativeSelect.Option>
        <NativeSelect.Option value="c">Cherry</NativeSelect.Option>
      </NativeSelect.Trigger>
    </NativeSelect>
  ));
  const select = r.container.querySelector("select")!;
  assert.equal(select.value, "b");
  assert.equal(r.container.querySelector("label")!.getAttribute("for"), select.id);
  select.value = "c";
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
  await flush();
  assert.equal(value(), "c");
  assert.deepEqual(calls, ["c"]);
  value.set("a");
  await flush();
  assert.equal(select.value, "a");
  r.unmount();
});

test("native-select: invalid + FieldError, disabled field", async () => {
  const r = render(() => (
    <>
      <div id="inv">
        <NativeSelect isInvalid aria-label="A">
          <NativeSelect.Trigger>
            <NativeSelect.Option value="">Choose</NativeSelect.Option>
          </NativeSelect.Trigger>
          <FieldError>Pick a value</FieldError>
        </NativeSelect>
      </div>
      <div id="dis">
        <NativeSelect isDisabled aria-label="B">
          <NativeSelect.Trigger>
            <NativeSelect.Option value="x">X</NativeSelect.Option>
          </NativeSelect.Trigger>
        </NativeSelect>
      </div>
    </>
  ));
  const inv = r.container.querySelector("#inv [data-slot=native-select]")!;
  const invSelect = inv.querySelector("select")!;
  assert.equal(inv.getAttribute("data-invalid"), "true");
  assert.equal(invSelect.getAttribute("aria-invalid"), "true");
  assert.equal(invSelect.getAttribute("data-invalid"), "true");
  assert.match(inv.textContent ?? "", /Pick a value/);
  const dis = r.container.querySelector("#dis")!;
  assert.equal(dis.querySelector("select")!.disabled, true);
  assert.equal(dis.querySelector("select")!.getAttribute("data-disabled"), "true");
  r.unmount();
});

test("native-select: live variant restyles in place", async () => {
  const variant = signal<"primary" | "secondary">("primary");
  const r = render(() => (
    <NativeSelect variant={variant()} aria-label="V">
      <NativeSelect.Trigger>
        <NativeSelect.Option value="x">X</NativeSelect.Option>
      </NativeSelect.Trigger>
    </NativeSelect>
  ));
  const root = r.container.querySelector("[data-slot=native-select]")!;
  const select = r.container.querySelector("select")!;
  assert.match(root.className, /native-select--primary/);
  variant.set("secondary");
  await flush();
  assert.match(root.className, /native-select--secondary/);
  assert.equal(r.container.querySelector("select"), select);
  r.unmount();
});

test("native-select items: append / remove / reorder / edit after mount, unchanged options keep their DOM nodes", async () => {
  type Item = { value: string; label: string };
  const items = signal<Item[]>([
    { value: "a", label: "A" },
    { value: "b", label: "B" },
  ]);
  const r = render(() => <NativeSelect aria-label="Live" items={items()} />);
  const option = (v: string) => r.container.querySelector(`option[value="${v}"]`) as HTMLOptionElement;
  const order = () => [...r.container.querySelectorAll("option")].map((o) => o.value);
  const a = option("a");
  const b = option("b");
  items.set([...items(), { value: "c", label: "C" }]);
  await flush();
  assert.deepEqual(order(), ["a", "b", "c"]);
  assert.equal(option("a"), a);
  assert.equal(option("b"), b);
  items.set(items().filter((i) => i.value !== "b"));
  await flush();
  assert.deepEqual(order(), ["a", "c"]);
  const c = option("c");
  items.set([...items()].reverse());
  await flush();
  assert.deepEqual(order(), ["c", "a"]);
  assert.equal(option("a"), a);
  assert.equal(option("c"), c);
  items.set(items().map((i) => (i.value === "a" ? { ...i, label: "Alpha" } : i)));
  await flush();
  assert.equal(option("a").textContent, "Alpha");
  assert.equal(option("a"), a);
  r.unmount();
});
