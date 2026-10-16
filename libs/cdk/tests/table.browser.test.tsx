// Ported from react-aria-components test/Table.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within`;
// `className` → `class`; render props are accessors (`isHovered()`); `jest.fn` → `vi.fn`; real timers;
// `rerender(<X …/>)` → `cleanup()` + `render` (or a signal for the controlled prop); testers from
// `@rivetjs/testing/user`; default classes `rv-*`; `useTableOptions` → `tableOptions`; the sort indicator glyphs
// (▲ ▼) → text, the checkbox SVG → none (icon rule); `TableContext` / `TableStateContext` reads are accessors.
// Skipped (reasons inline): `render` prop (not supported by cdk parts); RAC Virtualizer / TableLayout (no
// virtualized table yet); drag and drop (DnD lane); `data-rac` (Rivet renders none); Suspense / React
// `useSyncExternalStore` render counting (React internals).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { fireEvent, within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { User } from "@rivetjs/testing/user";
import { Button } from "../button/index.tsx";
import { Checkbox, CheckboxButton, CheckboxField } from "../checkbox/index.tsx";
import { Collection } from "../collections/components.tsx";
import {
  Cell,
  Column,
  ColumnResizer,
  ResizableTableContainer,
  Row,
  Table,
  TableBody,
  TableFooter,
  TableHeader,
  TableLoadMoreItem,
  tableOptions,
} from "../table/index.tsx";

const renderIt = (fn: () => unknown) => {
  const result = render(fn as never);
  return Object.assign(within(result.container as HTMLElement), { container: result.container as HTMLElement });
};
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

afterEach(() => cleanup());

function MyColumn(props: any) {
  return (
    <Column {...props}>
      {({ allowsSorting, sortDirection }: any) => (
        <>
          {props.children}
          {allowsSorting() ? (
            <span aria-hidden="true" class="sort-indicator">
              {sortDirection() === "ascending" ? "asc" : "desc"}
            </span>
          ) : null}
          {props.allowsResizing ? <ColumnResizer data-testid="resizer" /> : null}
        </>
      )}
    </Column>
  );
}

function MyCheckbox(props: { comp?: string }) {
  if (props.comp === "CheckboxField") {
    return (
      <CheckboxField slot="selection">
        <CheckboxButton />
      </CheckboxField>
    );
  }
  return <Checkbox slot="selection" />;
}

function MyTableHeader(props: any) {
  const { selectionBehavior, selectionMode, allowsDragging } = tableOptions();
  const { columns, children, ...otherProps } = props;
  return (
    <TableHeader {...otherProps}>
      {allowsDragging ? <Column /> : null}
      {selectionBehavior === "toggle" ? <Column>{selectionMode === "multiple" ? <MyCheckbox /> : null}</Column> : null}
      <Collection items={columns}>{children}</Collection>
    </TableHeader>
  );
}

function MyRow(props: any) {
  const { selectionBehavior, allowsDragging } = tableOptions();
  const { id, columns, children, checkboxComponent, ...otherProps } = props;
  return (
    <Row id={id} {...otherProps} columns={columns}>
      {allowsDragging ? (
        <Cell>
          <Button slot="drag">Drag</Button>
        </Cell>
      ) : null}
      {selectionBehavior === "toggle" ? (
        <Cell>
          <MyCheckbox comp={checkboxComponent} />
        </Cell>
      ) : null}
      <Collection items={columns}>{children}</Collection>
    </Row>
  );
}

const TestTable = (p: any = {}) => {
  const { tableProps = {}, tableHeaderProps = {}, columnProps = {}, tableBodyProps = {}, rowProps = {}, cellProps = {} } = p;
  return (
    <Table aria-label="Files" {...tableProps}>
      <MyTableHeader {...tableHeaderProps}>
        <MyColumn id="name" isRowHeader {...columnProps}>
          Name
        </MyColumn>
        <MyColumn {...columnProps}>Type</MyColumn>
        <MyColumn {...columnProps}>Date Modified</MyColumn>
      </MyTableHeader>
      <TableBody {...tableBodyProps}>
        <MyRow id="1" textValue="Games" {...rowProps}>
          <Cell {...cellProps}>Games</Cell>
          <Cell {...cellProps}>File folder</Cell>
          <Cell {...cellProps}>6/7/2020</Cell>
        </MyRow>
        <MyRow id="2" textValue="Program Files" {...rowProps}>
          <Cell {...cellProps}>Program Files</Cell>
          <Cell {...cellProps}>File folder</Cell>
          <Cell {...cellProps}>4/7/2021</Cell>
        </MyRow>
        <MyRow id="3" textValue="bootmgr" {...rowProps}>
          <Cell {...cellProps}>bootmgr</Cell>
          <Cell {...cellProps}>System file</Cell>
          <Cell {...cellProps}>11/20/2010</Cell>
        </MyRow>
      </TableBody>
    </Table>
  );
};

const columns = [
  { name: "Name", id: "name", isRowHeader: true },
  { name: "Type", id: "type" },
  { name: "Date Modified", id: "date" },
];

const rows = [
  { id: 1, name: "Games", date: "6/7/2020", type: "File folder" },
  { id: 2, name: "Program Files", date: "4/7/2021", type: "File folder" },
  { id: 3, name: "bootmgr", date: "11/20/2010", type: "System file" },
  { id: 4, name: "log.txt", date: "1/18/2016", type: "Text Document" },
];

const DynamicTable = (p: any = {}) => {
  const { tableProps = {}, tableHeaderProps = {}, tableBodyProps = {}, rowProps = {} } = p;
  return (
    <Table aria-label="Files" {...tableProps}>
      <MyTableHeader columns={columns} {...tableHeaderProps}>
        {(column: any) => <MyColumn isRowHeader={column.isRowHeader}>{column.name}</MyColumn>}
      </MyTableHeader>
      <TableBody items={rows} {...tableBodyProps}>
        {(item: any) => (
          <MyRow columns={columns} {...rowProps}>
            {(column: any) => <Cell>{item[column.id]}</Cell>}
          </MyRow>
        )}
      </TableBody>
    </Table>
  );
};

const renderTable = (props?: any) => renderIt(() => <TestTable {...(props ?? {})} />);

describe("Table", () => {
  let user: ReturnType<typeof userEvent.setup>;
  const testUtilUser = new User();
  beforeAll(() => {
    user = userEvent.setup({ delay: null });
  });

  it("should render with default classes", () => {
    const { getByRole } = renderTable();
    const tableTester = testUtilUser.createTester("Table", { root: getByRole("grid") });
    const table = tableTester.getTable();
    expect(table).toHaveAttribute("class", "rv-Table");
    for (const row of tableTester.getRows()) expect(row).toHaveAttribute("class", "rv-Row");
    const rowGroups = tableTester.getRowGroups();
    expect(rowGroups).toHaveLength(2);
    expect(rowGroups[0]).toHaveAttribute("class", "rv-TableHeader");
    expect(rowGroups[1]).toHaveAttribute("class", "rv-TableBody");
    for (const cell of tableTester.getColumns()) expect(cell).toHaveAttribute("class", "rv-Column");
    for (const cell of tableTester.getRowHeaders()) expect(cell).toHaveAttribute("class", "rv-Cell");
    for (const cell of tableTester.getCells()) expect(cell).toHaveAttribute("class", "rv-Cell");
  });
  it("should render with custom classes", () => {
    const { getByRole, getAllByRole } = renderTable({
      tableProps: { class: "table" },
      tableHeaderProps: { class: "table-header" },
      columnProps: { class: "column" },
      tableBodyProps: { class: "table-body" },
      rowProps: { class: "row" },
      cellProps: { class: "cell" },
    });
    expect(getByRole("grid")).toHaveAttribute("class", "table");
    for (const row of getAllByRole("row").slice(1)) expect(row).toHaveAttribute("class", "row");
    const rowGroups = getAllByRole("rowgroup");
    expect(rowGroups).toHaveLength(2);
    expect(rowGroups[0]).toHaveAttribute("class", "table-header");
    expect(rowGroups[1]).toHaveAttribute("class", "table-body");
    for (const cell of getAllByRole("columnheader")) expect(cell).toHaveAttribute("class", "column");
    for (const cell of getAllByRole("rowheader")) expect(cell).toHaveAttribute("class", "cell");
    for (const cell of getAllByRole("gridcell")) expect(cell).toHaveAttribute("class", "cell");
  });

  it("should support DOM props", () => {
    const { getByRole, getAllByRole } = renderTable({
      tableProps: { "data-testid": "table" },
      tableHeaderProps: { "data-testid": "table-header" },
      columnProps: { "data-testid": "column" },
      tableBodyProps: { "data-testid": "table-body" },
      rowProps: { "data-testid": "row" },
      cellProps: { "data-testid": "cell" },
    });
    expect(getByRole("grid")).toHaveAttribute("data-testid", "table");
    for (const row of getAllByRole("row").slice(1)) expect(row).toHaveAttribute("data-testid", "row");
    const rowGroups = getAllByRole("rowgroup");
    expect(rowGroups).toHaveLength(2);
    expect(rowGroups[0]).toHaveAttribute("data-testid", "table-header");
    expect(rowGroups[1]).toHaveAttribute("data-testid", "table-body");
    for (const cell of getAllByRole("columnheader")) expect(cell).toHaveAttribute("data-testid", "column");
    for (const cell of getAllByRole("rowheader")) expect(cell).toHaveAttribute("data-testid", "cell");
    for (const cell of getAllByRole("gridcell")) expect(cell).toHaveAttribute("data-testid", "cell");
  });

  // Skipped: "should support custom render function" — the RAC `render` prop is not supported by cdk parts.

  it.each(["Checkbox", "CheckboxField"])("should render checkboxes for selection using %s", async (comp) => {
    const { getAllByRole } = renderTable({ tableProps: { selectionMode: "multiple" }, rowProps: { checkboxComponent: comp } });
    for (const row of getAllByRole("row")) expect(within(row).getByRole("checkbox")).not.toBeChecked();
    const checkbox = getAllByRole("checkbox")[0]!;
    expect(checkbox).toHaveAttribute("aria-label", "Select All");
    await user.click(checkbox);
    for (const row of getAllByRole("row")) expect(within(row).getByRole("checkbox")).toBeChecked();
  });

  it("should support select all with Mod+A", async () => {
    const onSelectionChange = vi.fn();
    renderTable({ tableProps: { selectionMode: "multiple", onSelectionChange } });
    await user.tab();
    const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? "Meta" : "Control";
    await user.keyboard(`{${mod}>}a{/${mod}}`);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenLastCalledWith("all");
  });

  // "should support select all with Mod+A (Control) on Windows": covered above with the platform's modifier
  // (navigator.platform cannot be mocked in a real browser).

  it("should not select all with Mod+A when selection mode is single", async () => {
    const onSelectionChange = vi.fn();
    renderTable({ tableProps: { selectionMode: "single", onSelectionChange } });
    await user.tab();
    const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? "Meta" : "Control";
    await user.keyboard(`{${mod}>}a{/${mod}}`);
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('should prevent Esc from clearing selection if escapeKeyBehavior is "none"', async () => {
    const onSelectionChange = vi.fn();
    const { getAllByRole } = renderTable({ tableProps: { selectionMode: "multiple", escapeKeyBehavior: "none", onSelectionChange } });
    const checkbox1 = getAllByRole("checkbox")[1]!;
    await user.click(checkbox1);
    expect(checkbox1).toBeChecked();
    expect(new Set(onSelectionChange.mock.calls[0]![0])).toEqual(new Set(["1"]));
    const checkbox2 = getAllByRole("checkbox")[2]!;
    await user.click(checkbox2);
    expect(checkbox2).toBeChecked();
    expect(new Set(onSelectionChange.mock.calls[1]![0])).toEqual(new Set(["1", "2"]));
    await user.keyboard("{Escape}");
    expect(onSelectionChange).toHaveBeenCalledTimes(2);
    expect(checkbox1).toBeChecked();
    expect(checkbox2).toBeChecked();
  });

  it("should not render checkboxes for selection with selectionBehavior=replace", async () => {
    const { getAllByRole } = renderTable({ tableProps: { selectionMode: "multiple", selectionBehavior: "replace" } });
    for (const row of getAllByRole("row")) expect(within(row).queryByRole("checkbox")).toBeNull();
    const row = getAllByRole("row")[1]!;
    expect(row).toHaveAttribute("aria-selected", "false");
    await user.click(row);
    expect(row).toHaveAttribute("aria-selected", "true");
  });

  it("should support dynamic collections", () => {
    const { getAllByRole } = renderIt(() => <DynamicTable />);
    expect(getAllByRole("row")).toHaveLength(5);
  });

  it("should support rows with a falsy key", () => {
    const falsyKeyRows = [
      { id: 1, name: "One", date: "4/7/2021", type: "File folder" },
      { id: 0, name: "Zero", date: "6/7/2020", type: "File folder" },
      { id: 2, name: "Two", date: "11/20/2010", type: "System file" },
    ];
    const { getAllByRole } = renderIt(() => (
      <Table aria-label="Files">
        <MyTableHeader columns={columns}>{(column: any) => <MyColumn isRowHeader={column.isRowHeader}>{column.name}</MyColumn>}</MyTableHeader>
        <TableBody items={falsyKeyRows}>{(item: any) => <MyRow columns={columns}>{(column: any) => <Cell>{item[column.id]}</Cell>}</MyRow>}</TableBody>
      </Table>
    ));
    const r = getAllByRole("row");
    expect(r).toHaveLength(4);
    expect(r[1]).toHaveTextContent("One");
    expect(r[2]).toHaveTextContent("Zero");
    expect(r[3]).toHaveTextContent("Two");
  });

  it("should support column hover when sorting is allowed", async () => {
    const { getAllByRole } = renderTable({ columnProps: { allowsSorting: true, class: ({ isHovered }: any) => (isHovered() ? "hover" : "") } });
    const column = getAllByRole("columnheader")[0]!;
    expect(column).not.toHaveAttribute("data-hovered");
    expect(column).not.toHaveClass("hover");
    await user.hover(column);
    expect(column).toHaveAttribute("data-hovered", "true");
    expect(column).toHaveClass("hover");
    await user.unhover(column);
    expect(column).not.toHaveAttribute("data-hovered");
    expect(column).not.toHaveClass("hover");
  });

  it("should not show column hover state when column is not sortable", async () => {
    const { getAllByRole } = renderTable({ columnProps: { class: ({ isHovered }: any) => (isHovered() ? "hover" : "") } });
    const column = getAllByRole("columnheader")[0]!;
    await user.hover(column);
    expect(column).not.toHaveAttribute("data-hovered");
    expect(column).not.toHaveClass("hover");
  });

  it("should support hover", async () => {
    const onHoverStart = vi.fn();
    const onHoverChange = vi.fn();
    const onHoverEnd = vi.fn();
    const { getAllByRole } = renderTable({
      tableProps: { selectionMode: "multiple" },
      rowProps: { class: ({ isHovered }: any) => (isHovered() ? "hover" : ""), onHoverStart, onHoverChange, onHoverEnd },
    });
    const row = getAllByRole("row")[1]!;
    expect(row).not.toHaveAttribute("data-hovered");
    expect(row).not.toHaveClass("hover");
    await user.hover(row);
    expect(row).toHaveAttribute("data-hovered", "true");
    expect(row).toHaveClass("hover");
    expect(onHoverStart).toHaveBeenCalledTimes(1);
    expect(onHoverChange).toHaveBeenCalledTimes(1);
    await user.unhover(row);
    expect(row).not.toHaveAttribute("data-hovered");
    expect(row).not.toHaveClass("hover");
    expect(onHoverEnd).toHaveBeenCalledTimes(1);
    expect(onHoverChange).toHaveBeenCalledTimes(2);
  });

  // Skipped: "should show hover state on draggable rows even when not selectable/actionable" (DnD lane).

  it("should not show hover state when item is not interactive", async () => {
    const onHoverStart = vi.fn();
    const onHoverChange = vi.fn();
    const onHoverEnd = vi.fn();
    const { getAllByRole } = renderTable({
      rowProps: { class: ({ isHovered }: any) => (isHovered() ? "hover" : ""), onHoverStart, onHoverChange, onHoverEnd },
    });
    const row = getAllByRole("row")[1]!;
    await user.hover(row);
    expect(row).not.toHaveAttribute("data-hovered");
    expect(row).not.toHaveClass("hover");
    expect(onHoverStart).not.toHaveBeenCalled();
    expect(onHoverChange).not.toHaveBeenCalled();
    expect(onHoverEnd).not.toHaveBeenCalled();
  });

  it("should support hover events on the TableHeader", async () => {
    const onHoverStart = vi.fn();
    const onHoverChange = vi.fn();
    const onHoverEnd = vi.fn();
    const { getAllByRole } = renderTable({
      tableHeaderProps: { class: ({ isHovered }: any) => (isHovered() ? "hover" : ""), onHoverStart, onHoverChange, onHoverEnd },
    });
    const headerRow = getAllByRole("rowgroup")[0]!;
    expect(headerRow).not.toHaveAttribute("data-hovered");
    await user.hover(headerRow);
    expect(headerRow).toHaveAttribute("data-hovered");
    expect(headerRow).toHaveClass("hover");
    expect(onHoverStart).toHaveBeenCalledTimes(1);
    expect(onHoverChange).toHaveBeenCalledTimes(1);
    await user.unhover(headerRow);
    expect(headerRow).not.toHaveAttribute("data-hovered");
    expect(headerRow).not.toHaveClass("hover");
    expect(onHoverEnd).toHaveBeenCalledTimes(1);
    expect(onHoverChange).toHaveBeenCalledTimes(2);
  });

  it("should support focus ring", async () => {
    const { getAllByRole } = renderTable({
      rowProps: { class: ({ isFocusVisible }: any) => (isFocusVisible() ? "focus" : "") },
      cellProps: { class: ({ isFocusVisible }: any) => (isFocusVisible() ? "focus" : "") },
      columnProps: { class: ({ isFocusVisible }: any) => (isFocusVisible() ? "focus" : "") },
    });
    const row = getAllByRole("row")[1]!;
    const cell = within(row).getAllByRole("rowheader")[0]!;
    expect(row).not.toHaveAttribute("data-focus-visible");
    await user.tab();
    expect(document.activeElement).toBe(row);
    expect(row).toHaveAttribute("data-focus-visible", "true");
    expect(row).toHaveClass("focus");
    fireEvent.keyDown(row, { key: "ArrowRight" });
    fireEvent.keyUp(row, { key: "ArrowRight" });
    expect(document.activeElement).toBe(cell);
    expect(row).not.toHaveAttribute("data-focus-visible");
    expect(row).not.toHaveClass("focus");
    expect(cell).toHaveAttribute("data-focus-visible", "true");
    expect(cell).toHaveClass("focus");
    fireEvent.keyDown(row, { key: "ArrowUp" });
    fireEvent.keyUp(row, { key: "ArrowUp" });
    const column = getAllByRole("columnheader")[0]!;
    expect(document.activeElement).toBe(column);
    expect(column).toHaveAttribute("data-focus-visible", "true");
    expect(column).toHaveClass("focus");
  });

  it("should support press state", async () => {
    const { getAllByRole } = renderTable({
      tableProps: { selectionMode: "multiple" },
      rowProps: { class: ({ isPressed }: any) => (isPressed() ? "pressed" : "") },
    });
    const row = getAllByRole("row")[1]!;
    expect(row).not.toHaveAttribute("data-pressed");
    await user.pointer({ target: row, keys: "[MouseLeft>]" });
    expect(row).toHaveAttribute("data-pressed", "true");
    expect(row).toHaveClass("pressed");
    await user.pointer({ target: row, keys: "[/MouseLeft]" });
    expect(row).not.toHaveAttribute("data-pressed");
    expect(row).not.toHaveClass("pressed");
  });

  it("should not show press state when not interactive", async () => {
    const { getAllByRole } = renderTable({ rowProps: { class: ({ isPressed }: any) => (isPressed() ? "pressed" : "") } });
    const row = getAllByRole("row")[0]!;
    await user.pointer({ target: row, keys: "[MouseLeft>]" });
    expect(row).not.toHaveAttribute("data-pressed");
    expect(row).not.toHaveClass("pressed");
    await user.pointer({ target: row, keys: "[/MouseLeft]" });
    expect(row).not.toHaveAttribute("data-pressed");
  });

  it("should support row actions", async () => {
    const onRowAction = vi.fn();
    const { getAllByRole } = renderTable({ tableProps: { onRowAction }, rowProps: { class: ({ isPressed }: any) => (isPressed() ? "pressed" : "") } });
    const row = getAllByRole("row")[1]!;
    await user.pointer({ target: row, keys: "[MouseLeft>]" });
    expect(row).toHaveAttribute("data-pressed", "true");
    expect(row).toHaveClass("pressed");
    await user.pointer({ target: row, keys: "[/MouseLeft]" });
    expect(row).not.toHaveAttribute("data-pressed");
    expect(row).not.toHaveClass("pressed");
    expect(onRowAction).toHaveBeenCalledTimes(1);
  });

  it("should support disabled state", async () => {
    const { getByRole } = renderTable({
      tableProps: { selectionMode: "multiple", disabledKeys: ["2"], disabledBehavior: "all" },
      rowProps: { class: ({ isDisabled }: any) => (isDisabled() ? "disabled" : "") },
    });
    const tableTester = testUtilUser.createTester("Table", { root: getByRole("grid") });
    const disabledRow = tableTester.getRows()[1]!;
    expect(disabledRow).toHaveAttribute("aria-disabled", "true");
    expect(disabledRow).toHaveClass("disabled");
    expect(within(disabledRow).getByRole("checkbox")).toBeDisabled();
    await user.tab();
    expect(document.activeElement).toBe(tableTester.getRows()[0]);
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    fireEvent.keyUp(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(tableTester.getRows()[2]);
    await expect(tableTester.toggleRowSelection({ row: 1 })).rejects.toThrow();
    await expect(tableTester.triggerRowAction({ row: 1 })).rejects.toThrow();
  });

  it("should support isDisabled prop on rows", async () => {
    const { getAllByRole } = renderIt(() => (
      <Table aria-label="Table" selectionMode="multiple" disabledBehavior="all">
        <MyTableHeader>
          <Column isRowHeader>Foo</Column>
          <Column>Bar</Column>
          <Column>Baz</Column>
        </MyTableHeader>
        <TableBody>
          <MyRow>
            <Cell>Foo 1</Cell>
            <Cell>Bar 1</Cell>
            <Cell>Baz 1</Cell>
          </MyRow>
          <MyRow isDisabled>
            <Cell>Foo 2</Cell>
            <Cell>Bar 2</Cell>
            <Cell>Baz 2</Cell>
          </MyRow>
          <MyRow>
            <Cell>Foo 3</Cell>
            <Cell>Bar 3</Cell>
            <Cell>Baz 3</Cell>
          </MyRow>
        </TableBody>
      </Table>
    ));
    const items = getAllByRole("row");
    expect(items[2]).toHaveAttribute("aria-disabled", "true");
    await user.tab();
    expect(document.activeElement).toBe(items[1]);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(items[3]);
  });

  it("should support onAction on items", async () => {
    const onAction = vi.fn();
    const { getByRole } = renderIt(() => (
      <Table aria-label="Table" selectionMode="multiple" disabledBehavior="all">
        <MyTableHeader>
          <Column isRowHeader>Foo</Column>
          <Column>Bar</Column>
          <Column>Baz</Column>
        </MyTableHeader>
        <TableBody>
          <MyRow onAction={onAction}>
            <Cell>Foo 1</Cell>
            <Cell>Bar 1</Cell>
            <Cell>Baz 1</Cell>
          </MyRow>
          <MyRow>
            <Cell>Foo 2</Cell>
            <Cell>Bar 2</Cell>
            <Cell>Baz 2</Cell>
          </MyRow>
        </TableBody>
      </Table>
    ));
    const tableTester = testUtilUser.createTester("Table", { root: getByRole("grid") });
    await tableTester.triggerRowAction({ row: 0 });
    expect(onAction).toHaveBeenCalled();
  });

  it("should support sorting", async () => {
    const onSortChange = vi.fn();
    const { getByRole } = renderTable({
      tableProps: { sortDescriptor: { column: "name", direction: "ascending" }, onSortChange },
      columnProps: { allowsSorting: true },
    });
    const tableTester = testUtilUser.createTester("Table", { root: getByRole("grid") });
    const cols = tableTester.getColumns();
    expect(cols[0]).toHaveAttribute("aria-sort", "ascending");
    expect(cols[0]).toHaveTextContent("asc");
    expect(cols[1]).toHaveAttribute("aria-sort", "none");
    expect(cols[1]).not.toHaveTextContent("asc");
    expect(cols[2]).toHaveAttribute("aria-sort", "none");
    expect(cols[2]).not.toHaveTextContent("asc");
    await tableTester.toggleSort({ column: 0 });
    expect(onSortChange).toHaveBeenCalledTimes(1);
    expect(onSortChange).toHaveBeenCalledWith({ column: "name", direction: "descending" });
  });

  it("should support empty state", () => {
    const { getAllByRole, getByRole } = renderIt(() => (
      <Table aria-label="Search results">
        <TableHeader>
          <Column isRowHeader>Name</Column>
          <Column>Type</Column>
          <Column>Date Modified</Column>
        </TableHeader>
        <TableBody renderEmptyState={() => "No results"}>{[]}</TableBody>
      </Table>
    ));
    expect(getAllByRole("rowgroup")[1]).toHaveAttribute("data-empty", "true");
    expect(getByRole("rowheader")).toHaveTextContent("No results");
  });

  it("supports removing rows", async () => {
    const items = signal<any[]>(rows);
    const { getByRole } = renderIt(() => <DynamicTable tableBodyProps={{ items }} />);
    const tableTester = testUtilUser.createTester("Table", { root: getByRole("grid") });
    await user.tab();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowRight}");
    let gridRows = tableTester.getRows();
    expect(gridRows).toHaveLength(4);
    let cell = within(gridRows[1]!).getAllByRole("rowheader")[0]!;
    expect(cell).toHaveTextContent("Program Files");
    expect(document.activeElement).toBe(cell);
    items.set([rows[0], ...rows.slice(2)]);
    await frame();
    gridRows = tableTester.getRows();
    expect(gridRows).toHaveLength(3);
    cell = within(gridRows[1]!).getAllByRole("rowheader")[0]!;
    expect(cell).toHaveTextContent("bootmgr");
    expect(document.activeElement).toBe(cell);
  });

  it("does not hang restoring focus when no focusable row remains", async () => {
    const items = signal<any[]>(rows);
    const disabledKeys = signal<any[]>([]);
    const { getByRole } = renderIt(() => <DynamicTable tableProps={{ disabledBehavior: "all", disabledKeys: disabledKeys() }} tableBodyProps={{ items }} />);
    const tableTester = testUtilUser.createTester("Table", { root: getByRole("grid") });
    await user.tab();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowRight}");
    let gridRows = tableTester.getRows();
    const cell = within(gridRows[1]!).getAllByRole("rowheader")[0]!;
    expect(cell).toHaveTextContent("Program Files");
    expect(document.activeElement).toBe(cell);
    const remaining = [rows[0], ...rows.slice(2)];
    disabledKeys.set(remaining.map((r) => r!.id));
    items.set(remaining);
    await frame();
    gridRows = getByRole("grid").querySelectorAll("tbody tr") as never;
    expect(gridRows).toHaveLength(3);
    expect(document.activeElement).not.toBe(cell);
  });
  it("should support refs", async () => {
    const tableRef = ref<HTMLTableElement>();
    const headerRef = ref<HTMLTableSectionElement>();
    const columnRef = ref<HTMLTableCellElement>();
    const bodyRef = ref<HTMLTableSectionElement>();
    const rowRef = ref<HTMLTableRowElement>();
    const cellRef = ref<HTMLTableCellElement>();
    renderIt(() => (
      <Table aria-label="Search results" ref={tableRef}>
        <TableHeader ref={headerRef}>
          <Column isRowHeader ref={columnRef}>
            Name
          </Column>
          <Column>Type</Column>
        </TableHeader>
        <TableBody ref={bodyRef}>
          <Row ref={rowRef}>
            <Cell ref={cellRef}>Foo</Cell>
            <Cell>Bar</Cell>
          </Row>
        </TableBody>
      </Table>
    ));
    await flush();
    expect(tableRef()).toBeInstanceOf(HTMLTableElement);
    expect(headerRef()).toBeInstanceOf(HTMLTableSectionElement);
    expect(columnRef()).toBeInstanceOf(HTMLTableCellElement);
    expect(bodyRef()).toBeInstanceOf(HTMLTableSectionElement);
    expect(rowRef()).toBeInstanceOf(HTMLTableRowElement);
    expect(cellRef()).toBeInstanceOf(HTMLTableCellElement);
  });

  it("should support row render function and not call it with state", () => {
    const renderRow = vi.fn();
    renderIt(() => (
      <Table aria-label="Search results">
        <TableHeader columns={[columns[0]]}>{(column: any) => <Column isRowHeader={column.isRowHeader}>{column.name}</Column>}</TableHeader>
        <TableBody items={[rows[0]]}>
          {(item: any) => (
            <Row columns={[columns[0]]}>
              {(column: any) => {
                renderRow(column);
                return <Cell>{item[column.id]}</Cell>;
              }}
            </Row>
          )}
        </TableBody>
      </Table>
    ));
    expect(renderRow.mock.calls.length).toBeGreaterThanOrEqual(1);
    for (const call of renderRow.mock.calls) expect(call[0]).toBe(columns[0]);
  });

  it("should support cell render props", async () => {
    const { getAllByRole } = renderIt(() => (
      <Table aria-label="Search results">
        <TableHeader>
          <Column isRowHeader>{({ isFocused }: any) => `Name${isFocused() ? " (focused)" : ""}`}</Column>
          <Column>Type</Column>
        </TableHeader>
        <TableBody>
          <Row>
            <Cell>{({ isFocused }: any) => `Foo${isFocused() ? " (focused)" : ""}`}</Cell>
            <Cell>Bar</Cell>
          </Row>
        </TableBody>
      </Table>
    ));
    const headers = getAllByRole("columnheader");
    expect(headers[0]).toHaveTextContent("Name");
    headers[0]!.focus();
    await flush();
    expect(headers[0]).toHaveTextContent("Name (focused)");
    const cells = getAllByRole("rowheader");
    expect(cells[0]).toHaveTextContent("Foo");
    cells[0]!.focus();
    await flush();
    expect(cells[0]).toHaveTextContent("Foo (focused)");
  });

  it("should support column index in render props", () => {
    const { getAllByRole } = renderIt(() => (
      <Table aria-label="Search results">
        <TableHeader>
          <Column isRowHeader>Name</Column>
          <Column isRowHeader>Type</Column>
          <Column isRowHeader>Price</Column>
          <Column isRowHeader>Total</Column>
        </TableHeader>
        <TableBody>
          <Row>
            <Cell>{({ columnIndex }: any) => `cell index: ${columnIndex()}`}</Cell>
            <Cell>{({ columnIndex }: any) => `cell index: ${columnIndex()}`}</Cell>
            <Cell>{({ columnIndex }: any) => `cell index: ${columnIndex()}`}</Cell>
            <Cell>{({ columnIndex }: any) => `cell index: ${columnIndex()}`}</Cell>
          </Row>
        </TableBody>
      </Table>
    ));
    const cells = getAllByRole("rowheader");
    for (let i = 0; i < 4; i++) {
      expect(cells[i]).toHaveTextContent(`cell index: ${i}`);
      expect(cells[i]).toHaveAttribute("data-column-index", String(i));
    }
  });

  it("should support colspan with cell index", () => {
    const { getAllByRole } = renderIt(() => (
      <Table aria-label="Search results">
        <TableHeader>
          <Column isRowHeader>Name</Column>
          <Column isRowHeader>Type</Column>
          <Column isRowHeader>Price</Column>
          <Column isRowHeader>Total</Column>
        </TableHeader>
        <TableBody>
          <Row>
            <Cell colSpan={2}>{({ columnIndex }: any) => `cell index: ${columnIndex()}`}</Cell>
            <Cell>{({ columnIndex }: any) => `cell index: ${columnIndex()}`}</Cell>
            <Cell>{({ columnIndex }: any) => `cell index: ${columnIndex()}`}</Cell>
          </Row>
          <Row>
            <Cell>{({ columnIndex }: any) => `cell index: ${columnIndex()}`}</Cell>
            <Cell>{({ columnIndex }: any) => `cell index: ${columnIndex()}`}</Cell>
            <Cell>{({ columnIndex }: any) => `cell index: ${columnIndex()}`}</Cell>
            <Cell>{({ columnIndex }: any) => `cell index: ${columnIndex()}`}</Cell>
          </Row>
        </TableBody>
      </Table>
    ));
    const cells = getAllByRole("rowheader");
    const expected = [0, 2, 3, 0, 1, 2, 3];
    expected.forEach((index, i) => {
      expect(cells[i]).toHaveTextContent(`cell index: ${index}`);
      expect(cells[i]).toHaveAttribute("data-column-index", String(index));
    });
  });

  it("should support columnHeader typeahead", async () => {
    const { getAllByRole } = renderIt(() => (
      <Table aria-label="Files">
        <MyTableHeader columns={columns}>
          {(column: any) => (
            <MyColumn isRowHeader={column.isRowHeader} childColumns={column.children}>
              {column.name}
            </MyColumn>
          )}
        </MyTableHeader>
        <TableBody items={rows}>{(item: any) => <MyRow columns={columns}>{(column: any) => <Cell>{item[column.id]}</Cell>}</MyRow>}</TableBody>
      </Table>
    ));
    const rowElements = getAllByRole("row");
    await user.tab();
    expect(document.activeElement).toBe(rowElements[1]);
    await user.keyboard("boo");
    expect(document.activeElement).toBe(rowElements[3]);
  });

  it("should support textValue overriding typeahead", async () => {
    const rows = [
      { id: 1, name: "1. Games", date: "6/7/2020", type: "File folder", textValue: "Games" },
      { id: 2, name: "2. Program Files", date: "4/7/2021", type: "File folder", textValue: "Program Files" },
      { id: 3, name: "3. bootmgr", date: "11/20/2010", type: "System file", textValue: "bootmgr" },
      { id: 4, name: "4. log.txt", date: "1/18/2016", type: "Text Document", textValue: "log.txt" },
    ];
    const { getAllByRole } = renderIt(() => (
      <Table aria-label="Files">
        <MyTableHeader columns={columns}>
          {(column: any) => (
            <MyColumn isRowHeader={column.isRowHeader} childColumns={column.children}>
              {column.name}
            </MyColumn>
          )}
        </MyTableHeader>
        <TableBody items={rows}>
          {(item: any) => (
            <MyRow columns={columns} textValue={item.textValue}>
              {(column: any) => <Cell>{item[column.id]}</Cell>}
            </MyRow>
          )}
        </TableBody>
      </Table>
    ));
    const rowElements = getAllByRole("row");
    await user.tab();
    expect(document.activeElement).toBe(rowElements[1]);
    await user.keyboard("boo");
    expect(document.activeElement).toBe(rowElements[3]);
  });

  it("should support updating columns", async () => {
    const cols = signal<any[]>(columns);
    const { getAllByRole } = renderIt(() => (
      <Table aria-label="Files">
        <MyTableHeader columns={cols}>{(column: any) => <MyColumn isRowHeader={column.isRowHeader}>{column.name}</MyColumn>}</MyTableHeader>
        <TableBody items={rows} dependencies={[cols]}>
          {(item: any) => <MyRow columns={cols}>{(column: any) => <Cell>{item[column.id]}</Cell>}</MyRow>}
        </TableBody>
      </Table>
    ));
    expect(getAllByRole("columnheader")).toHaveLength(3);
    cols.set([columns[0], columns[2]]);
    await flush();
    expect(getAllByRole("columnheader")).toHaveLength(2);
  });

  it("should support updating and reordering a row at the same time", async () => {
    const items = signal<any[]>(rows);
    const { getAllByRole } = renderIt(() => <DynamicTable tableBodyProps={{ items }} />);
    expect(getAllByRole("rowheader").map((r) => r.textContent)).toEqual(["Games", "Program Files", "bootmgr", "log.txt"]);
    items.set([rows[1], { ...rows[0], name: "XYZ" }, ...rows.slice(2)]);
    await flush();
    expect(getAllByRole("rowheader").map((r) => r.textContent)).toEqual(["Program Files", "XYZ", "bootmgr", "log.txt"]);
  });

  it("should support onScroll", () => {
    const onScroll = vi.fn();
    const { getByRole } = renderTable({ tableProps: { onScroll } });
    fireEvent.scroll(getByRole("grid"));
    expect(onScroll).toHaveBeenCalled();
  });

  it("should support data-focus-visible-within", async () => {
    const { getAllByRole } = renderTable();
    const items = getAllByRole("row");
    expect(items[1]).not.toHaveAttribute("data-focus-visible-within", "true");
    await user.tab();
    expect(document.activeElement).toBe(items[1]);
    expect(items[1]).toHaveAttribute("data-focus-visible-within", "true");
    await user.keyboard("{ArrowRight}");
    const cell = within(items[1]!).getAllByRole("rowheader")[0];
    expect(document.activeElement).toBe(cell);
    expect(cell).toHaveAttribute("data-focus-visible", "true");
    expect(items[1]).toHaveAttribute("data-focus-visible-within", "true");
    await user.keyboard("{ArrowDown}");
    expect(items[1]).not.toHaveAttribute("data-focus-visible-within", "true");
  });

  it.skip("should support virtualizer (no virtualized Table: RAC Virtualizer + TableLayout not ported to the native table)", () => {});
  it.skip("should support nested collections with colliding keys (TagGroup not ported yet)", () => {});

  describe("colSpan", () => {
    const TableCellColSpan = () => (
      <Table aria-label="Table with various colspans">
        <TableHeader>
          <Column isRowHeader>Col 1</Column>
          <Column>Col 2</Column>
          <Column>Col 3</Column>
          <Column>Col 4</Column>
        </TableHeader>
        <TableBody>
          <Row>
            <Cell>Cell</Cell>
            <Cell colSpan={2}>Span 2</Cell>
            <Cell>Cell</Cell>
          </Row>
          <Row>
            <Cell>Cell</Cell>
            <Cell>Cell</Cell>
            <Cell>Cell</Cell>
            <Cell>Cell</Cell>
          </Row>
          <Row>
            <Cell colSpan={4}>Span 4</Cell>
          </Row>
          <Row>
            <Cell>Cell</Cell>
            <Cell>Cell</Cell>
            <Cell>Cell</Cell>
            <Cell>Cell</Cell>
          </Row>
          <Row>
            <Cell colSpan={3}>Span 3</Cell>
            <Cell>Cell</Cell>
          </Row>
          <Row>
            <Cell>Cell</Cell>
            <Cell>Cell</Cell>
            <Cell>Cell</Cell>
            <Cell>Cell</Cell>
          </Row>
          <Row>
            <Cell>Cell</Cell>
            <Cell colSpan={3}>Span 3</Cell>
          </Row>
        </TableBody>
      </Table>
    );
    const cellsOf = (row: HTMLElement) => [...within(row).queryAllByRole("rowheader"), ...within(row).queryAllByRole("gridcell")];

    it("should render table with colSpans", () => {
      const { getAllByRole } = renderIt(() => <TableCellColSpan />);
      const rows = getAllByRole("row");
      expect(rows).toHaveLength(8);
      const cells1 = cellsOf(rows[1]!);
      expect(cells1).toHaveLength(3);
      expect(cells1[0]).not.toHaveAttribute("aria-colindex");
      expect(cells1[1]).not.toHaveAttribute("aria-colindex");
      expect(cells1[1]).toHaveAttribute("colspan", "2");
      expect(cells1[2]).toHaveAttribute("aria-colindex", "4");
      const cells2 = cellsOf(rows[2]!);
      expect(cells2).toHaveLength(4);
      for (let i = 0; i < 4; i++) expect(cells2[i]).not.toHaveAttribute("aria-colindex", String(i + 1));
      const cells3 = within(rows[3]!).getAllByRole("rowheader");
      expect(cells3).toHaveLength(1);
      expect(cells3[0]).not.toHaveAttribute("aria-colindex");
      expect(cells3[0]).toHaveAttribute("colspan", "4");
      const cells5 = cellsOf(rows[5]!);
      expect(cells5).toHaveLength(2);
      expect(cells5[0]).not.toHaveAttribute("aria-colindex");
      expect(cells5[0]).toHaveAttribute("colspan", "3");
      expect(cells5[1]).toHaveAttribute("aria-colindex", "4");
    });

    it("should focus to the same colIndex when moving focus up or down", async () => {
      const { getAllByRole } = renderIt(() => <TableCellColSpan />);
      const rows = getAllByRole("row");
      const header = (i: number) => within(rows[i]!).getByRole("rowheader");
      const cell = (i: number, j: number) => within(rows[i]!).getAllByRole("gridcell")[j];
      await user.tab();
      expect(document.activeElement).toBe(rows[1]);
      await user.keyboard("{ArrowRight}");
      expect(document.activeElement).toBe(header(1));
      await user.keyboard("{ArrowRight}");
      expect(document.activeElement).toBe(cell(1, 0));
      await user.keyboard("{ArrowDown}");
      expect(document.activeElement).toBe(cell(2, 0));
      await user.keyboard("{ArrowDown}");
      expect(document.activeElement).toBe(header(3));
      await user.keyboard("{ArrowDown}");
      await user.keyboard("{ArrowRight}");
      expect(document.activeElement).toBe(cell(4, 0));
      await user.keyboard("{ArrowDown}");
      expect(document.activeElement).toBe(header(5));
      await user.keyboard("{ArrowDown}");
      await user.keyboard("{ArrowRight}");
      expect(document.activeElement).toBe(cell(6, 0));
      await user.keyboard("{ArrowDown}");
      expect(document.activeElement).toBe(cell(7, 0));
      await user.keyboard("{ArrowUp}");
      expect(document.activeElement).toBe(cell(6, 0));
      await user.keyboard("{ArrowRight}");
      await user.keyboard("{ArrowRight}");
      await user.keyboard("{ArrowUp}");
      expect(document.activeElement).toBe(cell(5, 0));
      await user.keyboard("{ArrowUp}");
      expect(document.activeElement).toBe(cell(4, 2));
      await user.keyboard("{ArrowUp}");
      expect(document.activeElement).toBe(header(3));
      await user.keyboard("{ArrowUp}");
      expect(document.activeElement).toBe(header(2));
      await user.keyboard("{ArrowRight}");
      await user.keyboard("{ArrowUp}");
      expect(document.activeElement).toBe(cell(1, 0));
    });

    it("should throw error if number of cells do not match column count", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      let error: any;
      try {
        renderIt(() => (
          <Table aria-label="Col Span Table with wrong number of cells">
            <TableHeader>
              <Column isRowHeader>Col 1</Column>
              <Column>Col 2</Column>
              <Column>Col 3</Column>
              <Column>Col 4</Column>
            </TableHeader>
            <TableBody>
              <Row>
                <Cell>Cell 11</Cell>
                <Cell colSpan={2}>Cell 12</Cell>
                <Cell>Cell 14</Cell>
              </Row>
              <Row>
                <Cell>Cell 21</Cell>
                <Cell colSpan={2}>Cell 22</Cell>
                <Cell>Cell 24</Cell>
                <Cell>Cell 25</Cell>
              </Row>
            </TableBody>
          </Table>
        ));
      } catch (e) {
        error = e;
      }
      expect(error?.message).toEqual("Cell count must match column count. Found 5 cells and 4 columns.");
      cleanup();
      error = undefined;
      try {
        renderIt(() => (
          <Table aria-label="Col Span Table with wrong number of cells">
            <TableHeader>
              <Column isRowHeader>Col 1</Column>
              <Column>Col 2</Column>
            </TableHeader>
            <TableBody>
              <Row>
                <Cell>Cell</Cell>
              </Row>
            </TableBody>
          </Table>
        ));
      } catch (e) {
        error = e;
      }
      expect(error?.message).toEqual("Cell count must match column count. Found 1 cells and 2 columns.");
      spy.mockRestore();
    });
  });
  it("should support overriding table style", () => {
    const { getByRole } = renderIt(() => (
      <Table aria-label="Table" style={{ width: "200px" }}>
        <MyTableHeader>
          <Column isRowHeader>Foo</Column>
          <Column>Bar</Column>
          <Column>Baz</Column>
        </MyTableHeader>
        <TableBody>
          <MyRow href="https://google.com">
            <Cell>Foo 1</Cell>
            <Cell>Bar 1</Cell>
            <Cell>Baz 1</Cell>
          </MyRow>
          <MyRow href="https://adobe.com">
            <Cell>Foo 2</Cell>
            <Cell>Bar 2</Cell>
            <Cell>Baz 2</Cell>
          </MyRow>
        </TableBody>
      </Table>
    ));
    expect(getByRole("grid")).toHaveAttribute("style", expect.stringContaining("width: 200px"));
  });

  describe("links", () => {
    describe.each(["mouse", "keyboard"] as const)("%s", (type) => {
      const trigger = async (item: HTMLElement, key = "Enter") => {
        if (type === "mouse") await user.click(item);
        else {
          fireEvent.keyDown(item, { key });
          fireEvent.keyUp(item, { key });
        }
      };
      // mockClickDefault: a window click listener that records + prevents the navigation.
      let onClick: ReturnType<typeof vi.fn>;
      const mockClickDefault = (opts: { once?: boolean } = {}) => {
        onClick = vi.fn((e: Event) => e.preventDefault());
        window.addEventListener("click", onClick as never, { once: opts.once });
        return onClick;
      };
      afterEach(() => window.removeEventListener("click", onClick as never));
      const target = (call: unknown[]) => (call[0] as Event).target as HTMLAnchorElement;
      const LinkTable = (p: any) => (
        <Table aria-label="Table" {...p}>
          <MyTableHeader>
            <Column isRowHeader>Foo</Column>
            <Column>Bar</Column>
            <Column>Baz</Column>
          </MyTableHeader>
          <TableBody>
            <MyRow href="https://google.com">
              <Cell>Foo 1</Cell>
              <Cell>Bar 1</Cell>
              <Cell>Baz 1</Cell>
            </MyRow>
            <MyRow href="https://adobe.com">
              <Cell>Foo 2</Cell>
              <Cell>Bar 2</Cell>
              <Cell>Baz 2</Cell>
            </MyRow>
          </TableBody>
        </Table>
      );

      it('should support links with selectionMode="none"', async () => {
        const { getAllByRole } = renderIt(() => <LinkTable />);
        const items = getAllByRole("row").slice(1);
        for (const item of items) {
          expect(item.tagName).not.toBe("A");
          expect(item).toHaveAttribute("data-href");
        }
        const onClick = mockClickDefault();
        await trigger(items[0]!);
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(target(onClick.mock.calls[0]!)).toBeInstanceOf(HTMLAnchorElement);
        expect(target(onClick.mock.calls[0]!).href).toBe("https://google.com/");
      });

      it.each(["single", "multiple"] as const)('should support links with selectionBehavior="toggle" selectionMode="%s"', async (selectionMode) => {
        const { getAllByRole } = renderIt(() => <LinkTable selectionMode={selectionMode} />);
        const items = getAllByRole("row").slice(1);
        for (const item of items) {
          expect(item.tagName).not.toBe("A");
          expect(item).toHaveAttribute("data-href");
        }
        const onClick = mockClickDefault();
        await trigger(items[0]!);
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(target(onClick.mock.calls[0]!)).toBeInstanceOf(HTMLAnchorElement);
        expect(target(onClick.mock.calls[0]!).href).toBe("https://google.com/");
        await user.click(within(items[0]!).getByRole("checkbox"));
        expect(items[0]).toHaveAttribute("aria-selected", "true");
        await trigger(items[1]!, " ");
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(items[1]).toHaveAttribute("aria-selected", "true");
      });

      it.each(["single", "multiple"] as const)('should support links with selectionBehavior="replace" selectionMode="%s"', async (selectionMode) => {
        const { getAllByRole } = renderIt(() => <LinkTable selectionMode={selectionMode} selectionBehavior="replace" />);
        const items = getAllByRole("row").slice(1);
        for (const item of items) {
          expect(item.tagName).not.toBe("A");
          expect(item).toHaveAttribute("data-href");
        }
        const onClick = mockClickDefault({ once: true });
        if (type === "mouse") await user.click(items[0]!);
        else {
          fireEvent.keyDown(items[0]!, { key: " " });
          fireEvent.keyUp(items[0]!, { key: " " });
        }
        expect(onClick).not.toHaveBeenCalled();
        expect(items[0]).toHaveAttribute("aria-selected", "true");
        if (type === "mouse") await user.dblClick(items[0]!);
        else {
          fireEvent.keyDown(items[0]!, { key: "Enter" });
          fireEvent.keyUp(items[0]!, { key: "Enter" });
        }
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(target(onClick.mock.calls[0]!)).toBeInstanceOf(HTMLAnchorElement);
        expect(target(onClick.mock.calls[0]!).href).toBe("https://google.com/");
      });
    });
  });

  describe("error state", () => {
    it("should throw a warning if the rows are rendered staticly without ids but the cells are rendered dynamically", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const cols = [
        { name: "Name", id: "name", isRowHeader: true },
        { name: "Type", id: "type" },
        { name: "Date Modified", id: "date" },
      ];
      const StaticRowDynamicCell = () => (
        <Table aria-label="Files">
          <TableHeader columns={cols}>{(column: any) => <Column isRowHeader={column.isRowHeader}>{column.name}</Column>}</TableHeader>
          <TableBody>
            <Row columns={cols}>{(_column: any) => <Cell>filler</Cell>}</Row>
            <Row columns={cols}>{(_column: any) => <Cell>filler</Cell>}</Row>
          </TableBody>
        </Table>
      );
      expect(() => renderIt(() => <StaticRowDynamicCell />)).toThrow(
        "No id detected for the Row element. The Row element requires a id to be provided to it when the cells are rendered dynamically.",
      );
      spy.mockRestore();
    });

    it("should throw an error if two rows share an id", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const DuplicateRowIds = () => (
        <Table aria-label="Files">
          <TableHeader>
            <Column isRowHeader>Name</Column>
            <Column>Type</Column>
          </TableHeader>
          <TableBody>
            <Row id="1">
              <Cell>Games</Cell>
              <Cell>File folder</Cell>
            </Row>
            <Row id="1">
              <Cell>Program Files</Cell>
              <Cell>File folder</Cell>
            </Row>
            <Row id="2">
              <Cell>bootmgr</Cell>
              <Cell>System file</Cell>
            </Row>
          </TableBody>
        </Table>
      );
      expect(() => renderIt(() => <DuplicateRowIds />)).toThrow('Duplicate key "1" found in collection. Every item in a collection must have a unique key.');
      spy.mockRestore();
    });
  });
});
