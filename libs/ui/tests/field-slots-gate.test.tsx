// DOM-target suite: upstream `useHasTextSlot` / `FieldSlotsGate` parity. HeroUI gates `Description` / `ErrorMessage` inside
// collection roots (TagGroup, Select, ComboBox, Autocomplete) until the root's visible pass provides the RAC `TextContext`
// slots; the visible DOM is then both parts rendered and linked through `aria-describedby`. Rivet drops the gate (cdk `Text`
// returns null in a hidden collection build pass itself), so this pins the upstream visible-pass outcome: inside a cdk
// `TagGroup`, Description + ErrorMessage render once (no duplicate from the build pass), carry the slot ids and the grid's
// `aria-describedby` lists them; standalone (outside a gate) they always render.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render, flush } = await import("@rivetjs/runtime/testing");
const { Tag, TagGroup, TagList } = await import("@rivetjs/cdk/tag-group");
const { Label } = await import("../src/components/label/index.ts");
const { Description } = await import("../src/components/description/index.ts");
const { ErrorMessage } = await import("../src/components/error-message/index.ts");

test("field-slots gate: Description / ErrorMessage inside a cdk TagGroup render once and are linked to the grid", async () => {
  const r = render(() => (
    <TagGroup>
      <Label>Pets</Label>
      <TagList>
        <Tag id="cat">Cat</Tag>
        <Tag id="dog">Dog</Tag>
      </TagList>
      <Description>Pick one</Description>
      <ErrorMessage>Required</ErrorMessage>
    </TagGroup>
  ));
  await flush();
  const descriptions = r.container.querySelectorAll('[data-slot="description"]');
  const errors = r.container.querySelectorAll('[data-slot="error-message"]');
  assert.equal(descriptions.length, 1, "one Description (none left from a hidden pass)");
  assert.equal(errors.length, 1, "one ErrorMessage");
  assert.equal(descriptions[0].className, "description");
  assert.equal(errors[0].className, "error-message");
  assert.equal(descriptions[0].textContent, "Pick one");
  assert.equal(errors[0].textContent, "Required");
  const grid = r.container.querySelector('[role="grid"]')!;
  assert.ok(grid);
  const describedBy = grid.getAttribute("aria-describedby")!;
  assert.ok(describedBy, "grid has aria-describedby");
  assert.deepEqual(
    describedBy.split(" ").map((id) => document.getElementById(id)?.textContent),
    ["Pick one", "Required"],
  );
  const labelledBy = grid.getAttribute("aria-labelledby")!;
  assert.equal(document.getElementById(labelledBy)?.textContent, "Pets");
  r.unmount();
});

test("field-slots gate: standalone Description / ErrorMessage (no gate) always render", () => {
  const r = render(() => (
    <>
      <Description>Hint</Description>
      <ErrorMessage>Oops</ErrorMessage>
    </>
  ));
  assert.equal(r.container.querySelector('[data-slot="description"]')?.textContent, "Hint");
  assert.equal(r.container.querySelector('[data-slot="error-message"]')?.textContent, "Oops");
  r.unmount();
});
