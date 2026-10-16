// Dev-only "no visible label" warning (`labelProps`, React Aria useLabel) on the server render of every cdk field that
// labels through it: silent with a `Label` child or an aria name, fires when nothing names the field.
// Regression (2026-10-12): the Select parts form computed its no-Label variant through `selectProps` too, so every
// Select warned in dev even with a `<Label>`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { importModule, renderHtml } from "./server.ts";

const source = `
import { Select, SelectValue } from "@rivetjs/cdk/select";
import { ComboBox } from "@rivetjs/cdk/combobox";
import { DatePicker } from "@rivetjs/cdk/date-picker";
import { TextField } from "@rivetjs/cdk/text-field";
import { SearchField } from "@rivetjs/cdk/search-field";
import { Label } from "@rivetjs/cdk/label";

import { Button } from "@rivetjs/cdk/button";
import { Input } from "@rivetjs/cdk/input";
import { Popover } from "@rivetjs/cdk/popover";
import { ListBox, ListBoxItem } from "@rivetjs/cdk/listbox";

const list = () => (
  <Popover>
    <ListBox>
      <ListBoxItem id="a">A</ListBoxItem>
    </ListBox>
  </Popover>
);

export const SelectLabel = () => (
  <Select>
    <Label>State</Label>
    <Button><SelectValue /></Button>
    {list()}
  </Select>
);
export const SelectAria = () => (
  <Select aria-label="State">
    <Button><SelectValue /></Button>
    {list()}
  </Select>
);
export const SelectNone = () => (
  <Select>
    <Button><SelectValue /></Button>
    {list()}
  </Select>
);
export const ComboLabel = () => (
  <ComboBox>
    <Label>Fruit</Label>
    <Input />
    <Button>v</Button>
    {list()}
  </ComboBox>
);
export const ComboNone = () => (
  <ComboBox>
    <Input />
    <Button>v</Button>
    {list()}
  </ComboBox>
);
export const PickerLabel = () => <DatePicker defaultValue="2024-03-10"><Label>Date</Label></DatePicker>;
export const TextLabel = () => <TextField><Label>Name</Label><Input /></TextField>;
export const TextNone = () => <TextField><Input /></TextField>;
export const PresetNone = () => <Select items={[{ id: "a", label: "A" }]} />;
export const PresetLabel = () => <Select label="State" items={[{ id: "a", label: "A" }]} />;

export const SearchLabel = () => <SearchField><Label>Find</Label><Input /></SearchField>;
`;

type Fixture = Record<string, () => unknown>;
const load = () => importModule<Fixture>("label-warning-fixture.tsx", source);
const LABEL_WARNING = "labelProps: If you do not provide a visible label";

describe("labelProps dev warning (server render)", () => {
  let env: string | undefined;
  let warn: { mock: { calls: unknown[][] }; mockRestore(): void };
  beforeEach(() => {
    env = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env.NODE_ENV = env;
    warn.mockRestore();
  });
  const warned = () => warn.mock.calls.some((args: unknown[]) => String(args[0]).includes(LABEL_WARNING));

  for (const name of ["SelectLabel", "SelectAria", "ComboLabel", "PickerLabel", "TextLabel", "SearchLabel"]) {
    it(`${name}: no warning`, async () => {
      const fixture = await load();
      await renderHtml(() => fixture[name]!());
      expect(warned()).toBe(false);
    });
  }
  // Parts-form fields (RAC useSlot) cannot know at creation that no Label will render: they assume one, as RAC's first
  // render does (RA warns only after its re-render; Rivet has none), so a Select / ComboBox / TextField without any
  // name stays silent. The warning fires where the label is known up front: the items preset Select (its `label` prop).
  for (const name of ["SelectNone", "ComboNone", "TextNone"]) {
    it(`${name}: silent (a Label is assumed)`, async () => {
      const fixture = await load();
      await renderHtml(() => fixture[name]!());
      expect(warned()).toBe(false);
    });
  }
  for (const name of ["PresetNone"]) {
    it(`${name}: warns (nothing names the field)`, async () => {
      const fixture = await load();
      await renderHtml(() => fixture[name]!());
      expect(warned()).toBe(true);
    });
  }
  it("PresetLabel: no warning", async () => {
    const fixture = await load();
    await renderHtml(() => fixture.PresetLabel!());
    expect(warned()).toBe(false);
  });
});
