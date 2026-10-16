// Ported from react-aria-components test/ListBox.ssr.test.js, Apache-2.0, © Adobe.
// Rivet: the server HTML is asserted directly (resume, the "hydrated" half upstream, is covered by
// tests-components/listbox.test.ts on the story app).
import { test } from "vitest";
import assert from "node:assert/strict";
import { importModule, renderHtml } from "./server.ts";

const page = (name: string, body: string) =>
  importModule<{ Page: () => unknown }>(
    name,
    `import { ListBox, ListBoxItem, ListBoxSection } from "@rivetjs/cdk/listbox";\nimport { Header } from "@rivetjs/cdk/header";\nexport function Page() { return ${body}; }`,
  );

const texts = (html: string, re: RegExp) => [...html.matchAll(re)].map((m) => m[1]!.replace(/<[^>]+>/g, ""));

test("should render without errors", async () => {
  const { Page } = await page(
    "listbox-ssr-1.tsx",
    `<ListBox aria-label="Listbox"><ListBoxItem id="1">Left</ListBoxItem><ListBoxItem id="2">Middle</ListBoxItem><ListBoxItem id="3">Right</ListBoxItem></ListBox>`,
  );
  const html = await renderHtml(() => Page());
  assert.match(html, /<div[^>]* role="listbox"/);
  assert.deepEqual(texts(html, /role="option"[^>]*>(.*?)<\/div>/g), ["Left", "Middle", "Right"]);
});

test("should render with sections", async () => {
  const { Page } = await page(
    "listbox-ssr-2.tsx",
    `<ListBox aria-label="Listbox">
      <ListBoxSection><Header>Veggies</Header><ListBoxItem id="lettuce">Lettuce</ListBoxItem><ListBoxItem id="tomato">Tomato</ListBoxItem><ListBoxItem id="onion">Onion</ListBoxItem></ListBoxSection>
      <ListBoxSection><Header>Protein</Header><ListBoxItem id="ham">Ham</ListBoxItem><ListBoxItem id="tuna">Tuna</ListBoxItem><ListBoxItem id="tofu">Tofu</ListBoxItem></ListBoxSection>
    </ListBox>`,
  );
  const html = await renderHtml(() => Page());
  const groups = [...html.matchAll(/<section[^>]*aria-labelledby="([^"]+)"[^>]*>(.*?)<\/section>/gs)];
  assert.equal(groups.length, 2);
  const headings = groups.map(([, id]) => new RegExp(`<header[^>]*id="${id}"[^>]*>(.*?)</header>`).exec(html)?.[1]);
  assert.deepEqual(headings, ["Veggies", "Protein"]);
  assert.deepEqual(texts(groups[0]![2]!, /role="option"[^>]*>(.*?)<\/div>/g), ["Lettuce", "Tomato", "Onion"]);
  assert.deepEqual(texts(groups[1]![2]!, /role="option"[^>]*>(.*?)<\/div>/g), ["Ham", "Tuna", "Tofu"]);
});

// Rivet: RAC mergeIds lets a user `<ListBox id>` win over the collection id an Autocomplete / ComboBox
// generates; the server renders the input (aria-controls) before the listbox, so the id must be known first.
test("Rivet: a section without a Header is named by aria-label only (no IDREF to a missing heading)", async () => {
  const { Page } = await page(
    "listbox-ssr-headerless.tsx",
    `<ListBox aria-label="Listbox">
      <ListBoxSection><Header>Veggies</Header><ListBoxItem id="lettuce">Lettuce</ListBoxItem></ListBoxSection>
      <ListBoxSection aria-label="Extras"><ListBoxItem id="bread">Bread</ListBoxItem></ListBoxSection>
    </ListBox>`,
  );
  const html = await renderHtml(() => Page());
  const sections = [...html.matchAll(/<section[^>]*>/g)].map(([tag]) => tag);
  assert.equal(sections.length, 2);
  const id = /aria-labelledby="([^"]+)"/.exec(sections[0]!)?.[1];
  assert.ok(id && html.includes(`id="${id}"`));
  assert.match(sections[1]!, /aria-label="Extras"/);
  assert.doesNotMatch(sections[1]!, /aria-labelledby/);
});

test("a user ListBox id wins in Autocomplete aria-controls on the server", async () => {
  const { Page } = await importModule<{ Page: () => unknown }>(
    "listbox-ssr-autocomplete.tsx",
    `import { Autocomplete } from "@rivetjs/cdk/autocomplete";
import { ListBox, ListBoxItem } from "@rivetjs/cdk/listbox";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { SearchField } from "@rivetjs/cdk/search-field";
export function Page() {
  return <Autocomplete><SearchField><Label>Search</Label><Input /></SearchField><ListBox id="user-list" aria-label="Commands"><ListBoxItem id="a">A</ListBoxItem></ListBox></Autocomplete>;
}`,
  );
  const html = await renderHtml(() => Page());
  assert.match(html, /<div[^>]* id="user-list"[^>]* role="listbox"|<div[^>]* role="listbox"[^>]* id="user-list"/);
  assert.match(html, /<input[^>]* aria-controls="user-list"/);
});
