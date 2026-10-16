// Server-target suite (upstream tests/components/autocomplete/autocomplete.ssr.test.tsx): `Autocomplete` closed (root, trigger group,
// value placeholder, indicator button, hidden select) and `defaultOpen` (popover, search field, listbox, options).
import { test } from "vitest";
import assert from "node:assert/strict";
import { createFilter } from "@rivetjs/cdk/i18n/filter";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Autocomplete, Label, ListBox, SearchField } from "../index.ts";

const { contains } = createFilter({ sensitivity: "base" }, "en-US");

const Fixture = (props: { defaultOpen?: boolean }) => (
  <Autocomplete data-testid="autocomplete" name="animal" defaultOpen={props.defaultOpen} placeholder="Select an animal" selectionMode="single">
    <Label>Favorite Animal</Label>
    <Autocomplete.Trigger>
      <Autocomplete.Value />
      <Autocomplete.Indicator />
    </Autocomplete.Trigger>
    <Autocomplete.Popover>
      <Autocomplete.Filter filter={(text, input) => contains(text, input)}>
        <SearchField autoFocus aria-label="Search animals" name="search" variant="secondary">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search animals..." />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <ListBox>
          <ListBox.Item id="cat" textValue="Cat">
            Cat
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="dog" textValue="Dog">
            Dog
            <ListBox.ItemIndicator />
          </ListBox.Item>
        </ListBox>
      </Autocomplete.Filter>
    </Autocomplete.Popover>
  </Autocomplete>
);

test("autocomplete SSR (upstream): closed renders the trigger group, placeholder and indicator button", async () => {
  const html = await renderToString(() => <Fixture />);
  assert.match(html, /data-slot="autocomplete"/);
  assert.match(html, /class="autocomplete autocomplete--primary"/);
  assert.match(html, /data-slot="autocomplete-trigger"/);
  assert.match(html, /class="autocomplete__trigger"/);
  assert.match(html, /role="group"/);
  assert.match(html, />Select an animal</);
  assert.match(html, /aria-haspopup="listbox"/);
  assert.match(html, /data-slot="autocomplete-default-indicator"/);
  assert.match(html, /<select[^>]*name="animal"/);
  assert.doesNotMatch(html, /role="listbox"/);
});

test("autocomplete SSR (upstream): defaultOpen renders popover, search field, listbox and options", async () => {
  const html = await renderToString(() => <Fixture defaultOpen />);
  assert.match(html, /data-slot="autocomplete-popover"/);
  assert.match(html, /class="autocomplete__popover/);
  assert.match(html, /type="search"/);
  assert.match(html, /role="listbox"/);
  assert.equal(html.match(/role="option"/g)?.length, 2);
  assert.match(html, /aria-expanded="true"/);
});

test("autocomplete SSR (Rivet): auto form renders the same closed and open markup as the compound form", async () => {
  const strip = (html: string) => html.replace(/\brv[\w-]*\d[\w-]*/g, "rv#");
  const auto = (open?: boolean) =>
    renderToString(() => (
      <Autocomplete
        data-testid="autocomplete"
        name="animal"
        defaultOpen={open}
        placeholder="Select an animal"
        label="Favorite Animal"
        searchLabel="Search animals"
      >
        <Autocomplete.Item id="cat">Cat</Autocomplete.Item>
        <Autocomplete.Item id="dog">Dog</Autocomplete.Item>
      </Autocomplete>
    ));
  const compound = (open?: boolean) =>
    renderToString(() => (
      <Autocomplete data-testid="autocomplete" name="animal" defaultOpen={open} placeholder="Select an animal">
        <Label>Favorite Animal</Label>
        <Autocomplete.Trigger>
          <Autocomplete.Value />
          <Autocomplete.Indicator />
        </Autocomplete.Trigger>
        <Autocomplete.Popover>
          <Autocomplete.Filter filter={(text, input) => contains(text, input)}>
            <SearchField autoFocus aria-label="Search animals" variant="secondary">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <ListBox>
              <ListBox.Item id="cat" textValue="Cat">
                Cat
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="dog" textValue="Dog">
                Dog
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Autocomplete.Filter>
        </Autocomplete.Popover>
      </Autocomplete>
    ));
  assert.equal(strip(await auto()), strip(await compound()));
  assert.equal(strip(await auto(true)), strip(await compound(true)));
});
