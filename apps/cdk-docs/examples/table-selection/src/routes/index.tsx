import { signal } from "@rivetjs/reactivity";
import { Cell, Column, Row, Table, TableBody, TableHeader } from "@rivetjs/cdk/table";
import type { Key, Selection } from "@rivetjs/cdk/collections/types";

export const head = { title: "Table: selection and actions" };

const th = "border-b border-slate-200 px-3 py-1.5 text-left font-semibold";
const td = "px-3 py-1.5";
const tr =
  "cursor-default outline-none data-[selected]:bg-sky-700 data-[selected]:text-white data-[disabled]:opacity-40 data-[focus-visible]:ring-2 data-[focus-visible]:ring-inset data-[focus-visible]:ring-sky-500";

// #region demo
export default function Favorites() {
  const selected = signal<Selection>(new Set<Key>());
  const action = signal("none");
  return (
    <section class="m-4 grid gap-2 text-sm">
      <Table
        id="favorites"
        aria-label="Favorite pokemon"
        selectionMode="multiple"
        selectedKeys={selected}
        onRowAction={(key) => action.set(String(key))}
        class="border-collapse"
      >
        <TableHeader>
          <Column isRowHeader class={th}>
            Name
          </Column>
          <Column class={th}>Type</Column>
          <Column class={th}>Level</Column>
        </TableHeader>
        <TableBody>
          <Row id="charizard" class={tr}>
            <Cell class={td}>Charizard</Cell>
            <Cell class={td}>Fire, Flying</Cell>
            <Cell class={td}>67</Cell>
          </Row>
          <Row id="blastoise" class={tr}>
            <Cell class={td}>Blastoise</Cell>
            <Cell class={td}>Water</Cell>
            <Cell class={td}>56</Cell>
          </Row>
          <Row id="venusaur" isDisabled class={tr}>
            <Cell class={td}>Venusaur</Cell>
            <Cell class={td}>Grass, Poison</Cell>
            <Cell class={td}>83</Cell>
          </Row>
          <Row id="pikachu" class={tr}>
            <Cell class={td}>Pikachu</Cell>
            <Cell class={td}>Electric</Cell>
            <Cell class={td}>100</Cell>
          </Row>
        </TableBody>
      </Table>
      <p id="favorites-selected">Current selection: {selected() === "all" ? "all" : [...(selected() as Set<Key>)].join(", ") || "none"}</p>
      <p id="favorites-action">Last action: {action()}</p>
      <button id="favorites-all" type="button" class="justify-self-start rounded border border-slate-300 px-2 py-0.5" onClick={() => selected.set("all")}>
        Select all
      </button>
    </section>
  );
}
// #endregion
