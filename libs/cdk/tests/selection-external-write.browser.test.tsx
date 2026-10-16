// Rivet: a caller writes the two-way `selectedKeys` Signal from outside the collection (an ActionBar "Clear selection"
// button: `selected.set(new Set())`, ui-docs `action-bar-basic`). RAC parity: a controlled `selectedKeys` change updates
// the collection — every option / row / tag follows the new value, and a later press starts from it. Covers ListBox,
// GridList, TagGroup, Table, DataGrid (Signal `selectedKeys`) and a multiple Select (Signal `value`).
import { afterEach, describe, expect, it } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { userEvent } from "@testing-library/user-event";
import { Button } from "../button/index.tsx";
import { DataGrid, type DataGridColumn } from "../data-grid/index.tsx";
import { GridList, GridListItem } from "../grid-list/index.tsx";
import { Label } from "../label/index.tsx";
import { ListBox, ListBoxItem } from "../listbox/index.tsx";
import { Popover } from "../popover/index.tsx";
import { Select, SelectValue } from "../select/index.tsx";
import { Cell, Column, Row, Table, TableBody, TableHeader } from "../table/index.tsx";
import { Tag, TagGroup, TagList } from "../tag-group/index.tsx";
import type { Key, Selection } from "../collections/types.ts";

afterEach(cleanup);

const settle = async () => {
  await flush();
  await new Promise((r) => setTimeout(r, 0));
  await flush();
};
const selectedIn = (root: ParentNode, sel: string) => [...root.querySelectorAll<HTMLElement>(sel)].filter((el) => el.getAttribute("aria-selected") === "true");

/** Press two items, clear from outside, select one from outside, press another: the collection follows every write. */
async function roundTrip(
  container: HTMLElement,
  items: () => HTMLElement[],
  sel: string,
  selected: ReturnType<typeof signal<Selection>>,
  keys: [Key, Key, Key],
) {
  const user = userEvent.setup();
  await user.click(items()[0]!);
  await user.click(items()[2]!);
  await settle();
  expect([...(selected() as Set<Key>)].sort()).toEqual([keys[0], keys[2]].sort());
  expect(selectedIn(container, sel)).toHaveLength(2);
  selected.set(new Set());
  await settle();
  expect(selectedIn(container, sel)).toHaveLength(0);
  selected.set(new Set([keys[1]]));
  await settle();
  expect(selectedIn(container, sel)).toEqual([items()[1]]);
  await user.click(items()[2]!);
  await settle();
  expect([...(selected() as Set<Key>)].sort()).toEqual([keys[1], keys[2]].sort());
  expect(selectedIn(container, sel)).toHaveLength(2);
  selected.set(new Set());
  await settle();
  expect(selectedIn(container, sel)).toHaveLength(0);
}

describe("external write to a two-way selection Signal", () => {
  it("ListBox", async () => {
    const selected = signal<Selection>(new Set());
    const { container } = render(() => (
      <ListBox aria-label="Files" selectionMode="multiple" selectedKeys={selected}>
        <ListBoxItem id="a">A</ListBoxItem>
        <ListBoxItem id="b">B</ListBoxItem>
        <ListBoxItem id="c">C</ListBoxItem>
      </ListBox>
    ));
    const items = () => [...container.querySelectorAll<HTMLElement>("[role=option]")];
    await roundTrip(container as HTMLElement, items, "[role=option]", selected, ["a", "b", "c"]);
  });

  it("GridList", async () => {
    const selected = signal<Selection>(new Set());
    const { container } = render(() => (
      <GridList aria-label="Files" selectionMode="multiple" selectedKeys={selected}>
        <GridListItem id="a">A</GridListItem>
        <GridListItem id="b">B</GridListItem>
        <GridListItem id="c">C</GridListItem>
      </GridList>
    ));
    const items = () => [...container.querySelectorAll<HTMLElement>("[role=row]")];
    await roundTrip(container as HTMLElement, items, "[role=row]", selected, ["a", "b", "c"]);
  });

  it("TagGroup", async () => {
    const selected = signal<Selection>(new Set());
    const { container } = render(() => (
      <TagGroup selectionMode="multiple" selectedKeys={selected}>
        <Label>Tags</Label>
        <TagList>
          <Tag id="a">A</Tag>
          <Tag id="b">B</Tag>
          <Tag id="c">C</Tag>
        </TagList>
      </TagGroup>
    ));
    const items = () => [...container.querySelectorAll<HTMLElement>("[role=row]")];
    await roundTrip(container as HTMLElement, items, "[role=row]", selected, ["a", "b", "c"]);
  });

  it("Table", async () => {
    const selected = signal<Selection>(new Set());
    const { container } = render(() => (
      <Table aria-label="Files" selectionMode="multiple" selectedKeys={selected}>
        <TableHeader>
          <Column isRowHeader>Name</Column>
        </TableHeader>
        <TableBody>
          <Row id="a">
            <Cell>A</Cell>
          </Row>
          <Row id="b">
            <Cell>B</Cell>
          </Row>
          <Row id="c">
            <Cell>C</Cell>
          </Row>
        </TableBody>
      </Table>
    ));
    const items = () => [...container.querySelectorAll<HTMLElement>("tbody [role=row]")];
    await roundTrip(container as HTMLElement, items, "tbody [role=row]", selected, ["a", "b", "c"]);
  });

  it("DataGrid", async () => {
    interface Person {
      id: number;
      name: string;
    }
    const people: Person[] = [
      { id: 1, name: "Ada" },
      { id: 2, name: "Grace" },
      { id: 3, name: "Linus" },
    ];
    const columns: DataGridColumn<Person>[] = [{ id: "name", header: "Name", accessorKey: "name", isRowHeader: true }];
    const selected = signal<Selection>(new Set());
    const { container } = render(() => <DataGrid aria-label="People" data={people} columns={columns} selectionMode="multiple" selectedKeys={selected} />);
    const items = () => [...container.querySelectorAll<HTMLElement>("[role=row][aria-selected]")];
    const cells = () => items().map((row) => row.querySelector<HTMLElement>("[role=rowheader], [role=gridcell]")!);
    const user = userEvent.setup();
    await user.click(cells()[0]!);
    await user.click(cells()[2]!);
    await settle();
    expect([...(selected() as Set<Key>)].sort()).toEqual([1, 3]);
    expect(selectedIn(container, "[role=row]")).toHaveLength(2);
    selected.set(new Set());
    await settle();
    expect(selectedIn(container, "[role=row]")).toHaveLength(0);
    selected.set(new Set([2]));
    await settle();
    expect(selectedIn(container, "[role=row]")).toEqual([items()[1]]);
    await user.click(cells()[2]!);
    await settle();
    expect([...(selected() as Set<Key>)].sort()).toEqual([2, 3]);
    selected.set(new Set());
    await settle();
    expect(selectedIn(container, "[role=row]")).toHaveLength(0);
  });

  it("Select multiple (value Signal)", async () => {
    const value = signal<readonly Key[]>([]);
    const { container } = render(() => (
      <Select data-testid="select" selectionMode="multiple" value={value}>
        <Label>Animals</Label>
        <Button>
          <SelectValue />
        </Button>
        <Popover>
          <ListBox>
            <ListBoxItem id="cat">Cat</ListBoxItem>
            <ListBoxItem id="dog">Dog</ListBoxItem>
          </ListBox>
        </Popover>
      </Select>
    ));
    const valueText = () => container.querySelector(".rv-SelectValue")!.textContent;
    const empty = valueText();
    value.set(["cat", "dog"]);
    await settle();
    expect(valueText()).toContain("Cat");
    value.set([]);
    await settle();
    expect(valueText()).toBe(empty);
    const user = userEvent.setup();
    await user.click(container.querySelector("button")!);
    await settle();
    const options = () => [...document.querySelectorAll<HTMLElement>("[role=option]")];
    await user.click(options()[1]!);
    await settle();
    expect(value()).toEqual(["dog"]);
    value.set([]);
    await settle();
    expect(options().filter((o) => o.getAttribute("aria-selected") === "true")).toHaveLength(0);
  });
});
