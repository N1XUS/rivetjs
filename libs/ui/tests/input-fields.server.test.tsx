// Server-target suite: `InputGroup`, `SearchField`, `NumberField` SSR markup (upstream search-field / number-field `ssr` cases + classes;
// SearchField `aria-describedby` only for rendered parts; T21 shorthand = the compound form's HTML).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { InputGroup, inputGroupVariants } from "../src/components/input-group/index.ts";
import { SearchField, searchFieldVariants } from "../src/components/search-field/index.ts";
import { NumberField, numberFieldVariants } from "../src/components/number-field/index.ts";
import { TextField } from "../src/components/textfield/index.ts";
import { Label } from "../src/components/label/index.ts";
import { Description } from "../src/components/description/index.ts";
import { assertSameHtml } from "./same-html.ts";

test("input-group SSR: parts, classes, TextField variant", async () => {
  const html = await renderToString(() => (
    <TextField name="amount" variant="secondary">
      <Label>Amount</Label>
      <InputGroup>
        <InputGroup.Prefix>$</InputGroup.Prefix>
        <InputGroup.Input />
        <InputGroup.Suffix>USD</InputGroup.Suffix>
      </InputGroup>
    </TextField>
  ));
  const slots = inputGroupVariants({ variant: "secondary" });
  assert.match(html, new RegExp(`class="${slots.base()}"[^>]*data-slot="input-group"|data-slot="input-group"[^>]*class="${slots.base()}"`));
  assert.match(html, /<input[^>]*data-slot="input-group-input"/);
  assert.match(html, /data-slot="input-group-prefix"[^>]*>\$<\/div>|class="input-group__prefix"[^>]*>\$</);
  assert.match(html, /data-slot="input-group-suffix"/);
});

test("search-field SSR: default value renders the field + clear button (upstream)", async () => {
  const html = await renderToString(() => (
    <SearchField defaultValue="hero" name="search">
      <Label>Search</Label>
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  ));
  assert.match(html, /data-slot="search-field"/);
  assert.match(html, /data-slot="search-field-clear-button"/);
  assert.match(html, /<input[^>]*type="search"/);
  assert.match(html, /value="hero"/);
  assert.match(html, /<svg[^>]*data-slot="search-field-search-icon"/);
  assert.ok(html.includes(searchFieldVariants({}).group()));
});

test("number-field SSR: default value renders the field + input (upstream)", async () => {
  const html = await renderToString(() => (
    <NumberField defaultValue={1024} name="width">
      <Label>Width</Label>
      <NumberField.Group>
        <NumberField.DecrementButton />
        <NumberField.Input />
        <NumberField.IncrementButton />
      </NumberField.Group>
    </NumberField>
  ));
  assert.match(html, /data-slot="number-field"/);
  assert.match(html, /data-slot="number-field-input"/);
  assert.match(html, /value="1,024"/);
  assert.match(html, /data-slot="number-field-increment-button-icon"/);
  assert.ok(html.includes(numberFieldVariants({}).incrementButton()));
});

test("search-field SSR: aria-describedby names only the parts that render (no IDREF to a missing Description / FieldError)", async () => {
  const bare = await renderToString(() => (
    <SearchField id="order-search" aria-label="Search orders">
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  ));
  assert.doesNotMatch(bare, /aria-describedby/);
  const described = await renderToString(() => (
    <SearchField id="mail-search">
      <Label>Search</Label>
      <SearchField.Group>
        <SearchField.Input />
      </SearchField.Group>
      <Description>Searches subjects and senders</Description>
    </SearchField>
  ));
  const ref = /<input[^>]* aria-describedby="([^"]+)"/.exec(described)?.[1];
  assert.ok(ref, described);
  assert.match(described, new RegExp(` id="${ref}"`));
});

test("shorthand SSR (T21): SearchField / NumberField label + description + placeholder = the compound form", async () => {
  await assertSameHtml(
    () => <SearchField name="q" label="Search" description="Titles only" placeholder="Search..." />,
    () => (
      <SearchField name="q">
        <Label>Search</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="Search..." />
          <SearchField.ClearButton />
        </SearchField.Group>
        <Description>Titles only</Description>
      </SearchField>
    ),
  );
  await assertSameHtml(
    () => <NumberField name="w" defaultValue={3} label="Width" />,
    () => (
      <NumberField name="w" defaultValue={3}>
        <Label>Width</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input />
          <NumberField.IncrementButton />
        </NumberField.Group>
      </NumberField>
    ),
  );
});

test("shorthand precedence (T21): SearchField children win over label / placeholder (dev warning)", async () => {
  const { DEV } = await import("#dev");
  const warns: string[] = [];
  const warn = console.warn;
  console.warn = (m: string) => void warns.push(m);
  try {
    const parts = () => (
      <>
        <Label>Own</Label>
        <SearchField.Group>
          <SearchField.Input />
        </SearchField.Group>
      </>
    );
    await assertSameHtml(
      () => (
        <SearchField id="p" label="Ignored" placeholder="Ignored">
          {parts()}
        </SearchField>
      ),
      () => <SearchField id="p">{parts()}</SearchField>,
    );
    if (DEV) assert.ok(warns.includes("[rivet ui] SearchField: children and label/items both given; children win"), warns.join("\n"));
  } finally {
    console.warn = warn;
  }
});
