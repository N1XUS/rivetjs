// Type-level suite (`tsc -p libs/ui` only): `Table` parts (cdk Table props + render-prop accessors), compound prop types, errors.
import { Table } from "../src/components/table/index.ts";

interface Row {
  id: string;
  name: string;
}
const rows: Row[] = [{ id: "1", name: "A" }];

export const table = () => (
  <Table variant="secondary" class="x">
    <Table.ScrollContainer>
      <Table.Content aria-label="t" selectionMode="multiple" keyboardNavigationBehavior="arrow" onSortChange={(d) => void d.direction}>
        <Table.Header>
          <Table.Column allowsSorting isRowHeader id="name" class={({ isHovered }) => (isHovered() ? "h" : "")}>
            {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Name</Table.SortableColumnHeader>}
          </Table.Column>
        </Table.Header>
        <Table.Body items={rows} renderEmptyState={() => "Empty"}>
          {(row: Row) => (
            <Table.Row id={row.id} onAction={() => {}}>
              <Table.Cell textValue={row.name}>{row.name}</Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table.Content>
    </Table.ScrollContainer>
    <Table.Footer>f</Table.Footer>
  </Table>
);

const p: Table["Props"] = { variant: "primary" };
const s: Table["SortableColumnHeaderProps"] = { sortDirection: "descending", showIndicator: false };
void p;
void s;

// @ts-expect-error bad variant
export const badVariant = () => <Table variant="tertiary" />;

// @ts-expect-error bad sort direction
export const badDirection = () => <Table.SortableColumnHeader sortDirection="up" />;

// Rivet auto form: `columns` + `items` (row type inferred for the row renderer), cdk Table props on the root.
export const auto = () => (
  <Table aria-label="t" columns={[{ id: "name", name: "Name", isRowHeader: true, allowsSorting: true }]} items={rows} selectionMode="single" footer="f">
    {(row) => (
      <Table.Row id={row.id}>
        <Table.Cell>{row.name}</Table.Cell>
      </Table.Row>
    )}
  </Table>
);
const col: Table["ColumnDef"] = { id: "x", name: "X" };
void col;

// @ts-expect-error column needs a name
export const badColumn = () => <Table aria-label="t" columns={[{ id: "x" }]} items={rows} />;
