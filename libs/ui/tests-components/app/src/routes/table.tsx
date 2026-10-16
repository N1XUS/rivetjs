// P3-COLLECTIONS — Table stories (`/table`): `#tbl` = upstream table.test `renderTable` (selection checkboxes, sortable Member
// column; two-way `selectedKeys` / `sortDescriptor` signals echoed in `#tbl-sel` / `#tbl-sort`, sorted rows from a computed);
// `#tbl-input` / `#tbl-textarea` / `#tbl-select` / `#tbl-ce` / `#tbl-arrow` = upstream `renderTypeaheadTable` (editable cell in
// the "Alpha" row, "Year Range" row below; `#tbl-arrow` uses `keyboardNavigationBehavior="arrow"`).
import { computed, signal } from "@rivetjs/reactivity";
import type { Selection, SortDescriptor } from "@rivetjs/cdk/collections/types";
import { Checkbox } from "@rivetjs/ui/checkbox";
import { Input } from "@rivetjs/ui/input";
import { Table } from "@rivetjs/ui/table";
import { TextField } from "@rivetjs/ui/textfield";

interface Member {
  id: string;
  name: string;
  role: string;
}

const rows: Member[] = [
  { id: "1", name: "Kate", role: "CEO" },
  { id: "2", name: "John", role: "CTO" },
  { id: "3", name: "Sara", role: "CMO" },
];

function TypeaheadTable(props: { id: string; kind: "input" | "textarea" | "select" | "contenteditable"; behavior?: "arrow" | "tab" }) {
  return (
    <Table id={props.id}>
      <Table.ScrollContainer>
        <Table.Content id={`${props.id}-grid`} aria-label="Editable values" keyboardNavigationBehavior={props.behavior}>
          <Table.Header>
            <Table.Column isRowHeader>Name</Table.Column>
            <Table.Column>Value</Table.Column>
          </Table.Header>
          <Table.Body>
            <Table.Row id="alpha">
              <Table.Cell>Alpha</Table.Cell>
              <Table.Cell>
                {props.kind === "input" ? (
                  <TextField aria-label="Alpha value">
                    <Input />
                  </TextField>
                ) : props.kind === "textarea" ? (
                  <textarea aria-label="Alpha value" />
                ) : props.kind === "select" ? (
                  <select aria-label="Alpha value">
                    <option value="alpha">Alpha</option>
                    <option value="yes">Yes</option>
                  </select>
                ) : (
                  <div contentEditable="true" aria-label="Alpha value" role="textbox" tabIndex={0}>
                    <span data-testid="contenteditable-target">Edit</span>
                  </div>
                )}
              </Table.Cell>
            </Table.Row>
            <Table.Row id="year-range">
              <Table.Cell>Year Range</Table.Cell>
              <Table.Cell>2020–2026</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

export default function TableStories() {
  const selected = signal<Selection>(new Set());
  const sort = signal<SortDescriptor | null>({ column: "name", direction: "ascending" });
  const sorted = computed(() => {
    const s = sort();
    if (!s) return rows;
    const sign = s.direction === "descending" ? -1 : 1;
    return [...rows].sort((a, b) => sign * a.name.localeCompare(b.name));
  });
  return (
    <main class="grid gap-6 p-6">
      <Table id="tbl">
        <Table.ScrollContainer>
          <Table.Content id="tbl-grid" aria-label="Team" selectionMode="multiple" selectedKeys={selected} sortDescriptor={sort}>
            <Table.Header>
              <Table.Column>
                <Checkbox aria-label="Select all" slot="selection">
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                  </Checkbox.Content>
                </Checkbox>
              </Table.Column>
              <Table.Column allowsSorting isRowHeader id="name">
                {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Member</Table.SortableColumnHeader>}
              </Table.Column>
              <Table.Column id="role">Role</Table.Column>
            </Table.Header>
            <Table.Body items={sorted}>
              {(row: Member) => (
                <Table.Row id={row.id}>
                  <Table.Cell>
                    <Checkbox aria-label={`Select ${row.name}`} slot="selection">
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox.Content>
                    </Checkbox>
                  </Table.Cell>
                  <Table.Cell>{row.name}</Table.Cell>
                  <Table.Cell>{row.role}</Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      <output id="tbl-sel">
        {(() => {
          const keys = selected();
          return keys === "all" ? "all" : [...keys].join(",");
        })()}
      </output>
      <output id="tbl-sort">{sort() ? `${String(sort()!.column)} ${sort()!.direction}` : "none"}</output>
      <TypeaheadTable id="tbl-input" kind="input" />
      <TypeaheadTable id="tbl-textarea" kind="textarea" />
      <TypeaheadTable id="tbl-select" kind="select" />
      <TypeaheadTable id="tbl-ce" kind="contenteditable" />
      <TypeaheadTable id="tbl-arrow" kind="input" behavior="arrow" />
    </main>
  );
}
