// Ported from react-aria test/table/tableResizingTests.tsx (the shared `resizingTests` suite) as run by
// react-aria-components test/Table.test.js "column resizing" (react-spectrum, Apache-2.0, © Adobe).
// Changes: real Chromium layout instead of mocked `clientWidth`: the ResizableTableContainer is 900px wide
// (`resizeTable` sets its width and waits for the ResizeObserver); `fireEvent.pointerMove` uses `clientX`
// (PointerEvent `pageX` is computed from it in a browser); controlled widths / column updates are signals
// (`rerender` → `signal.set`); no fake timers; `jest.fn` → `vi.fn`.
import { afterEach, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { computed, signal, type Signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { fireEvent, within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { setInteractionModality } from "../interactions/focus-visible.tsx";
import { Collection } from "../collections/components.tsx";
import { Checkbox } from "../checkbox/index.tsx";
import { Cell, Column, ColumnResizer, ResizableTableContainer, Row, Table, TableBody, TableHeader, tableOptions } from "../table/index.tsx";

afterEach(() => cleanup());

const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

const rows = [
  { id: 1, name: "Charizard", type: "Fire, Flying", level: "67", weight: "200lbs", height: "5'7\"" },
  { id: 2, name: "Blastoise", type: "Water", level: "56", weight: "188lbs", height: "5'3\"" },
  { id: 3, name: "Venusaur", type: "Grass, Poison", level: "83", weight: "220lbs", height: "6'7\"" },
  { id: 4, name: "Pikachu", type: "Electric", level: "100", weight: "13lbs", height: "1'4\"" },
  { id: 5, name: "Charizard", type: "Fire, Flying", level: "67", weight: "200lbs", height: "5'7\"" },
  { id: 6, name: "Blastoise", type: "Water", level: "56", weight: "188lbs", height: "5'3\"" },
];

function MyColumn(props: any) {
  return (
    <Column {...props}>
      {() => (
        <>
          {props.children}
          {props.allowsResizing ? <ColumnResizer data-testid="resizer" /> : null}
        </>
      )}
    </Column>
  );
}

function MyTableHeader(props: any) {
  const { selectionBehavior, selectionMode } = tableOptions();
  const { columns, children, ...otherProps } = props;
  return (
    <TableHeader {...otherProps}>
      {selectionBehavior === "toggle" ? <Column>{selectionMode === "multiple" ? <Checkbox slot="selection" /> : null}</Column> : null}
      <Collection items={columns}>{children}</Collection>
    </TableHeader>
  );
}

function MyRow(props: any) {
  const { id, columns, children, ...otherProps } = props;
  return (
    <Row id={id} {...otherProps} columns={columns}>
      <Collection items={columns}>{children}</Collection>
    </Row>
  );
}

const CONTAINER_STYLE = { width: "900px" };

function ResizableTable(props: any) {
  const { columns, rows, onResizeStart, onResize, onResizeEnd, ...otherProps } = props;
  return (
    <ResizableTableContainer style={CONTAINER_STYLE} onResizeStart={onResizeStart} onResize={onResize} onResizeEnd={onResizeEnd}>
      <Table aria-label="Files" {...otherProps}>
        <MyTableHeader columns={columns}>
          {(column: any) => (
            <MyColumn {...column} isRowHeader={column.id === "name"}>
              {column.name}
            </MyColumn>
          )}
        </MyTableHeader>
        <TableBody items={rows}>{(item: any) => <MyRow columns={columns}>{(column: any) => <Cell>{item[column.id]}</Cell>}</MyRow>}</TableBody>
      </Table>
    </ResizableTableContainer>
  );
}

const defaultColumns = [
  { name: "Name", uid: "name", width: "1fr" },
  { name: "Type", uid: "type", width: "1fr" },
  { name: "Height", uid: "height" },
  { name: "Weight", uid: "weight" },
  { name: "Level", uid: "level", width: "5fr" },
];

/** RAC ControlledResizableTable: `columns` may be a signal (the `rerender` of the upstream suite). */
function ControlledResizableTable(props: any) {
  const columns: Signal<any[]> | (() => any[]) = props.columns ?? (() => defaultColumns);
  const initial = columns();
  const widths = signal<Map<unknown, unknown>>(new Map(initial.filter((col: any) => col.width).map((col: any) => [col.uid, col.width])));
  const cols = computed(() => columns().map((col: any) => ({ ...col, width: widths().get(col.uid) })));
  const { onResizeStart, onResizeEnd } = props;
  const onResizeProp = props.onResize;
  return (
    <ResizableTableContainer
      style={CONTAINER_STYLE}
      onResizeStart={onResizeStart}
      onResize={(w) => {
        widths.set(w);
        onResizeProp?.(w);
      }}
      onResizeEnd={onResizeEnd}
    >
      <Table aria-label="Files">
        <MyTableHeader columns={cols}>
          {(column: any) => (
            <MyColumn {...column} id={column.uid} isRowHeader={column.uid === "name"} allowsResizing>
              {column.name}
            </MyColumn>
          )}
        </MyTableHeader>
        <TableBody items={rows}>{(item: any) => <MyRow columns={cols}>{(column: any) => <Cell>{item[column.uid]}</Cell>}</MyRow>}</TableBody>
      </Table>
    </ResizableTableContainer>
  );
}

type Tree = ReturnType<typeof within> & { container: HTMLElement };
const renderIt = async (fn: () => unknown): Promise<Tree> => {
  const result = render(fn as never);
  await frame();
  return Object.assign(within(result.container as HTMLElement), { container: result.container as HTMLElement });
};

function getColumnWidths(tree: Tree) {
  const all = tree.getAllByRole("row");
  return Array.from(all[0]!.children).map((cell) => Number((cell as HTMLElement).style.width.replace("px", "")));
}

// I'd use tree.getByRole(role, {name: text}) here, but it's unbearably slow.
function getColumn(tree: Tree, name: string) {
  let el: HTMLElement | null = tree.getByText(name);
  while (el && !/columnheader/.test(el.getAttribute("role") ?? "")) el = el.parentElement;
  return el!;
}

async function resizeCol(tree: Tree, col: string, delta: number) {
  setInteractionModality("pointer");
  const column = getColumn(tree, col);
  const resizer = within(column).getByRole("slider");
  fireEvent.pointerEnter(resizer);
  // actual locations do not matter, the delta matters between events for the calculation of useMove
  fireEvent.pointerDown(resizer, { pointerType: "mouse", pointerId: 1, clientX: 0, clientY: 30, button: 0 });
  fireEvent.pointerMove(resizer, { pointerType: "mouse", pointerId: 1, clientX: delta, clientY: 25 });
  fireEvent.pointerUp(resizer, { pointerType: "mouse", pointerId: 1, button: 0 });
  await flush();
}

async function resizeTable(tree: Tree, newValue: number) {
  (tree.container.querySelector(".rv-ResizableTableContainer") as HTMLElement).style.width = `${newValue}px`;
  await frame();
  await flush();
}

const mapFromWidths = (columnNames: string[], widths: unknown[]) => new Map(widths.map((width, i) => [columnNames[i]!.toLowerCase(), width]));

// The controlled cases feed widths back through a `columns` signal read by a nested `<Collection items>` in the
// table's build pass (tracked: the build re-enters its observer in part bodies).
const itControlled = (name: string, fn: () => Promise<void>): void => it(name, fn);

describe("Resizing", () => {
  describe.each([{ allowsResizing: undefined }, { allowsResizing: true }])("initial column sizes allowsResizing=$allowsResizing", ({ allowsResizing }) => {
    const sizes = async (columns: any[]) => getColumnWidths(await renderIt(() => <ResizableTable columns={columns} rows={rows} />));
    it("should handle no value if table was written with default widths", async () => {
      const columns = [
        { name: "Name", id: "name", allowsResizing },
        { name: "Type", id: "type", allowsResizing },
        { name: "Level", id: "level", allowsResizing },
      ];
      expect(await sizes(columns)).toStrictEqual([300, 300, 300]);
    });
    it("should handle default pixel widths", async () => {
      const columns = [
        { name: "Name", id: "name", defaultWidth: 100, allowsResizing },
        { name: "Type", id: "type", defaultWidth: 100, allowsResizing },
        { name: "Level", id: "level", defaultWidth: 400, allowsResizing },
      ];
      expect(await sizes(columns)).toStrictEqual([100, 100, 400]);
    });
    it("should handle default percent widths", async () => {
      const columns = [
        { name: "Name", id: "name", defaultWidth: "50%", allowsResizing },
        { name: "Type", id: "type", defaultWidth: "16%", allowsResizing },
        { name: "Level", id: "level", defaultWidth: "33%", allowsResizing },
      ];
      expect(await sizes(columns)).toStrictEqual([450, 144, 297]);
    });
    it("should handle default fr widths", async () => {
      const columns = [
        { name: "Name", id: "name", defaultWidth: "4fr", allowsResizing },
        { name: "Type", id: "type", defaultWidth: "3fr", allowsResizing },
        { name: "Level", id: "level", defaultWidth: "2fr", allowsResizing },
      ];
      expect(await sizes(columns)).toStrictEqual([400, 300, 200]);
    });
    it("should handle a mix of default widths", async () => {
      const columns = [
        { name: "Name", id: "name", defaultWidth: "50%", allowsResizing },
        { name: "Type", id: "type", defaultWidth: "2fr", allowsResizing },
        { name: "Level", id: "level", defaultWidth: 100, allowsResizing },
        { name: "Height", id: "height", allowsResizing },
      ];
      expect(await sizes(columns)).toStrictEqual([450, 233, 100, 117]);
    });
    it('any single remaining column with an FR will take the remaining space, regardless of how many FRs it is "worth"', async () => {
      const columns = [
        { name: "Name", id: "name", defaultWidth: "50%", allowsResizing },
        { name: "Type", id: "type", defaultWidth: 100, allowsResizing },
        { name: "Level", id: "level", defaultWidth: 100, allowsResizing },
        { name: "Height", id: "height", allowsResizing },
      ];
      expect(await sizes(columns)).toStrictEqual([450, 100, 100, 250]);
    });
    it("cannot size less than the minWidth", async () => {
      const columns = [
        { name: "Name", id: "name", minWidth: 500, defaultWidth: "50%", allowsResizing },
        { name: "Type", id: "type", minWidth: 100, defaultWidth: "1fr", allowsResizing },
        { name: "Level", id: "level", minWidth: 150, defaultWidth: 100, allowsResizing },
        { name: "Height", id: "height", minWidth: 200, allowsResizing },
      ];
      expect(await sizes(columns)).toStrictEqual([500, 100, 150, 200]);
    });
    it("cannot size more than the maxWidth", async () => {
      const columns = [
        { name: "Name", id: "name", maxWidth: 400, defaultWidth: "50%", allowsResizing },
        { name: "Type", id: "type", maxWidth: 100, defaultWidth: "1fr", allowsResizing },
        { name: "Level", id: "level", maxWidth: 100, defaultWidth: 150, allowsResizing },
        { name: "Height", id: "height", maxWidth: 100, allowsResizing },
      ];
      expect(await sizes(columns)).toStrictEqual([400, 100, 100, 100]);
    });
    it("minWidth can be a percent", async () => {
      const columns = [
        { name: "Name", id: "name", minWidth: "50%", defaultWidth: "30%", allowsResizing },
        { name: "Type", id: "type", maxWidth: 100, defaultWidth: "1fr", allowsResizing },
        { name: "Level", id: "level", maxWidth: 100, defaultWidth: 100, allowsResizing },
        { name: "Height", id: "height", maxWidth: 100, allowsResizing },
      ];
      expect(await sizes(columns)).toStrictEqual([450, 100, 100, 100]);
    });
    it("maxWidth can be a percent", async () => {
      const columns = [
        { name: "Name", id: "name", maxWidth: "50%", defaultWidth: "70%", allowsResizing },
        { name: "Type", id: "type", maxWidth: 100, defaultWidth: "1fr", allowsResizing },
        { name: "Level", id: "level", maxWidth: 100, defaultWidth: 100, allowsResizing },
        { name: "Height", id: "height", maxWidth: 100, allowsResizing },
      ];
      expect(await sizes(columns)).toStrictEqual([450, 100, 100, 100]);
    });
  });

  describe("interactions", () => {
    const columnNames = ["Name", "Type", "Height", "Weight", "Level"];
    it.each`
      col         | delta  | expected                     | expectedOnResize
      ${"Name"}   | ${-50} | ${[75, 103, 103, 103, 516]}  | ${[75, "1fr", "1fr", "1fr", "5fr"]}
      ${"Name"}   | ${50}  | ${[150, 94, 94, 93, 469]}    | ${[150, "1fr", "1fr", "1fr", "5fr"]}
      ${"Type"}   | ${-50} | ${[100, 75, 104, 103, 518]}  | ${[100, 75, "1fr", "1fr", "5fr"]}
      ${"Type"}   | ${50}  | ${[100, 150, 93, 93, 464]}   | ${[100, 150, "1fr", "1fr", "5fr"]}
      ${"Height"} | ${-50} | ${[100, 100, 75, 104, 521]}  | ${[100, 100, 75, "1fr", "5fr"]}
      ${"Height"} | ${50}  | ${[100, 100, 150, 92, 458]}  | ${[100, 100, 150, "1fr", "5fr"]}
      ${"Weight"} | ${-50} | ${[100, 100, 100, 75, 525]}  | ${[100, 100, 100, 75, "5fr"]}
      ${"Weight"} | ${50}  | ${[100, 100, 100, 150, 450]} | ${[100, 100, 100, 150, "5fr"]}
      ${"Level"}  | ${-50} | ${[100, 100, 100, 100, 450]} | ${[100, 100, 100, 100, 450]}
      ${"Level"}  | ${50}  | ${[100, 100, 100, 100, 550]} | ${[100, 100, 100, 100, 550]}
    `("can resize $col to be $delta px different", async ({ col, delta, expected, expectedOnResize }) => {
      const onResize = vi.fn();
      const onResizeEnd = vi.fn();
      const tree = await renderIt(() => <ControlledResizableTable onResize={onResize} onResizeEnd={onResizeEnd} />);
      expect(getColumnWidths(tree)).toStrictEqual([100, 100, 100, 100, 500]);
      await resizeCol(tree, col, delta);
      expect(getColumnWidths(tree)).toStrictEqual(expected);
      expect(onResize).toHaveBeenCalledTimes(1);
      expect(onResize).toHaveBeenCalledWith(mapFromWidths(columnNames, expectedOnResize));
      tree.getAllByRole("slider").forEach((resizer: HTMLElement, index: number) => {
        expect(resizer).toHaveAttribute("value", `${expected[index]}`);
        expect(resizer).toHaveAttribute("min", `${75}`);
        expect(resizer).toHaveAttribute("max", `${Number.MAX_SAFE_INTEGER}`);
      });
      expect(onResizeEnd).toHaveBeenCalledTimes(1);
      expect(onResizeEnd).toHaveBeenCalledWith(mapFromWidths(columnNames, expectedOnResize));
    });

    const minCols = [
      { name: "Name", uid: "name", width: "1fr", minWidth: 100 },
      { name: "Type", uid: "type", width: "1fr", minWidth: 100 },
      { name: "Height", uid: "height", minWidth: 100 },
      { name: "Weight", uid: "weight", minWidth: 100 },
      { name: "Level", uid: "level", width: "4fr", minWidth: 100 },
    ];
    const maxCols = [
      { name: "Name", uid: "name", width: "1fr", maxWidth: 150 },
      { name: "Type", uid: "type", width: "1fr", maxWidth: 150 },
      { name: "Height", uid: "height", maxWidth: 200 },
      { name: "Weight", uid: "weight", maxWidth: 200 },
      { name: "Level", uid: "level", width: "4fr", maxWidth: 500 },
    ];
    const frCols = [
      { name: "Name", uid: "name", width: "1fr" },
      { name: "Type", uid: "type", width: "1fr" },
      { name: "Height", uid: "height" },
      { name: "Weight", uid: "weight" },
      { name: "Level", uid: "level", width: "4fr" },
    ];
    const withoutWeight = frCols.filter((c) => c.uid !== "weight");
    const controlled = (columns: any[], extra: any = {}) => {
      const cols = signal<any[]>(columns);
      return { cols, tree: renderIt(() => <ControlledResizableTable columns={cols} {...extra} />) };
    };

    itControlled("cannot resize to be less than a minWidth, from start to end", async () => {
      const onResize = vi.fn();
      const tree = await controlled(minCols, { onResize }).tree;
      await resizeCol(tree, "Name", -50); // first column
      expect(getColumnWidths(tree)).toStrictEqual([100, 114, 115, 114, 457]);
      expect(onResize).toHaveBeenCalledTimes(1);
      expect(onResize).toHaveBeenCalledWith(mapFromWidths(columnNames, [100, "1fr", "1fr", "1fr", "4fr"]));
      await resizeCol(tree, "Type", -50);
      expect(getColumnWidths(tree)).toStrictEqual([100, 100, 117, 116, 467]);
      expect(onResize).toHaveBeenCalledTimes(2);
      expect(onResize).toHaveBeenCalledWith(mapFromWidths(columnNames, [100, 100, "1fr", "1fr", "4fr"]));
      await resizeCol(tree, "Height", -100);
      expect(getColumnWidths(tree)).toStrictEqual([100, 100, 100, 120, 480]);
      expect(onResize).toHaveBeenCalledTimes(3);
      expect(onResize).toHaveBeenCalledWith(mapFromWidths(columnNames, [100, 100, 100, "1fr", "4fr"]));
      await resizeCol(tree, "Weight", -100);
      expect(getColumnWidths(tree)).toStrictEqual([100, 100, 100, 100, 500]);
      expect(onResize).toHaveBeenCalledTimes(4);
      expect(onResize).toHaveBeenCalledWith(mapFromWidths(columnNames, [100, 100, 100, 100, "4fr"]));
      await resizeCol(tree, "Level", -500); // last column
      expect(getColumnWidths(tree)).toStrictEqual([100, 100, 100, 100, 100]);
      expect(onResize).toHaveBeenCalledTimes(5);
      expect(onResize).toHaveBeenCalledWith(mapFromWidths(columnNames, [100, 100, 100, 100, 100]));
      tree.getAllByRole("slider").forEach((resizer: HTMLElement) => {
        expect(resizer).toHaveAttribute("min", `${100}`);
        expect(resizer).toHaveAttribute("max", `${Number.MAX_SAFE_INTEGER}`);
      });
    });

    itControlled("cannot resize to be less than a minWidth, from end to start", async () => {
      const tree = await controlled(minCols).tree;
      await resizeCol(tree, "Level", -500); // last column
      expect(getColumnWidths(tree)).toStrictEqual([113, 112, 113, 112, 100]);
      await resizeCol(tree, "Weight", -100);
      expect(getColumnWidths(tree)).toStrictEqual([113, 112, 113, 100, 100]);
      await resizeCol(tree, "Height", -100);
      expect(getColumnWidths(tree)).toStrictEqual([113, 112, 100, 100, 100]);
      await resizeCol(tree, "Type", -100);
      expect(getColumnWidths(tree)).toStrictEqual([113, 100, 100, 100, 100]);
      await resizeCol(tree, "Name", -500); // first column
      expect(getColumnWidths(tree)).toStrictEqual([100, 100, 100, 100, 100]);
    });

    itControlled("cannot resize to be more than a maxWidth, from start to end", async () => {
      const tree = await controlled(maxCols).tree;
      await resizeCol(tree, "Name", 150);
      expect(getColumnWidths(tree)).toStrictEqual([150, 107, 107, 107, 429]);
      await resizeCol(tree, "Type", 150);
      expect(getColumnWidths(tree)).toStrictEqual([150, 150, 100, 100, 400]);
      await resizeCol(tree, "Height", 150);
      expect(getColumnWidths(tree)).toStrictEqual([150, 150, 200, 80, 320]);
      await resizeCol(tree, "Weight", 200);
      expect(getColumnWidths(tree)).toStrictEqual([150, 150, 200, 200, 200]);
      await resizeCol(tree, "Level", 400);
      expect(getColumnWidths(tree)).toStrictEqual([150, 150, 200, 200, 500]);
      const expectedMaxWidths = [150, 150, 200, 200, 500];
      tree.getAllByRole("slider").forEach((resizer: HTMLElement, i: number) => {
        expect(resizer).toHaveAttribute("min", `${75}`);
        expect(resizer).toHaveAttribute("max", `${expectedMaxWidths[i]}`);
      });
    });

    itControlled("cannot resize to be more than a maxWidth, from end to start", async () => {
      const tree = await controlled(maxCols).tree;
      await resizeCol(tree, "Level", 150);
      expect(getColumnWidths(tree)).toStrictEqual([113, 112, 113, 112, 500]);
      await resizeCol(tree, "Weight", 150);
      expect(getColumnWidths(tree)).toStrictEqual([113, 112, 113, 200, 500]);
      await resizeCol(tree, "Height", 100);
      expect(getColumnWidths(tree)).toStrictEqual([113, 112, 200, 200, 500]);
      await resizeCol(tree, "Type", 100);
      expect(getColumnWidths(tree)).toStrictEqual([113, 150, 200, 200, 500]);
      await resizeCol(tree, "Name", 400);
      expect(getColumnWidths(tree)).toStrictEqual([150, 150, 200, 200, 500]);
    });

    itControlled("resizing the starter column will preserve fr column ratios to the right", async () => {
      const tree = await controlled(frCols).tree;
      expect(getColumnWidths(tree)).toStrictEqual([113, 112, 113, 112, 450]);
      await resizeCol(tree, "Name", -50);
      expect(getColumnWidths(tree)).toStrictEqual([75, 118, 118, 118, 471]);
      await resizeCol(tree, "Name", 38); // send it back to original size
      expect(getColumnWidths(tree)).toStrictEqual([113, 112, 113, 112, 450]);
    });

    itControlled("resizing the last column will lock columns to pixels to the left", async () => {
      const tree = await controlled(frCols).tree;
      await resizeCol(tree, "Level", -50);
      expect(getColumnWidths(tree)).toStrictEqual([113, 112, 113, 112, 400]);
      await resizeCol(tree, "Level", 50);
      expect(getColumnWidths(tree)).toStrictEqual([113, 112, 113, 112, 450]);
    });

    itControlled("can handle removing a column", async () => {
      const { cols, tree: t } = controlled(frCols);
      const tree = await t;
      expect(getColumnWidths(tree)).toStrictEqual([113, 112, 113, 112, 450]);
      cols.set(withoutWeight);
      await flush();
      expect(getColumnWidths(tree)).toStrictEqual([129, 128, 129, 514]);
    });

    itControlled("can handle adding a column", async () => {
      const { cols, tree: t } = controlled(withoutWeight);
      const tree = await t;
      expect(getColumnWidths(tree)).toStrictEqual([129, 128, 129, 514]);
      cols.set(frCols);
      await flush();
      expect(getColumnWidths(tree)).toStrictEqual([113, 112, 113, 112, 450]);
    });

    itControlled("can handle resizing, then removing an uncontrolled column, then adding the column again", async () => {
      const { cols, tree: t } = controlled(frCols);
      const tree = await t;
      await resizeCol(tree, "Name", -50);
      expect(getColumnWidths(tree)).toStrictEqual([75, 118, 118, 118, 471]);
      cols.set(withoutWeight);
      await flush();
      expect(getColumnWidths(tree)).toStrictEqual([75, 138, 137, 550]);
      cols.set(frCols);
      await flush();
      expect(getColumnWidths(tree)).toStrictEqual([75, 118, 118, 118, 471]);
    });

    itControlled("can handle resizing, then removing an controlled column, then adding the column again", async () => {
      const { cols, tree: t } = controlled(frCols);
      const tree = await t;
      await resizeCol(tree, "Name", -50);
      expect(getColumnWidths(tree)).toStrictEqual([75, 118, 118, 118, 471]);
      cols.set(frCols.filter((c) => c.uid !== "level"));
      await flush();
      expect(getColumnWidths(tree)).toStrictEqual([75, 275, 275, 275]);
      cols.set(frCols);
      await flush();
      expect(getColumnWidths(tree)).toStrictEqual([75, 118, 118, 118, 471]);
    });

    itControlled("can add new columns after resizing", async () => {
      const { cols, tree: t } = controlled(frCols.slice(0, 3));
      const tree = await t;
      await resizeCol(tree, "Name", -50);
      expect(getColumnWidths(tree)).toStrictEqual([250, 325, 325]);
      cols.set(frCols);
      await flush();
      expect(getColumnWidths(tree)).toStrictEqual([250, 163, 162, 163, 162]);
    });

    itControlled("can remove and re-add the resized column", async () => {
      const { cols, tree: t } = controlled(frCols);
      const tree = await t;
      await resizeCol(tree, "Type", -50);
      expect(getColumnWidths(tree)).toStrictEqual([113, 75, 119, 118, 475]);
      cols.set(frCols.filter((c) => c.uid !== "type"));
      await flush();
      expect(getColumnWidths(tree)).toStrictEqual([113, 131, 131, 525]);
      cols.set(frCols);
      await flush();
      expect(getColumnWidths(tree)).toStrictEqual([113, 75, 119, 118, 475]);
    });

    itControlled("can resize smaller if the minWidth gets smaller", async () => {
      const { cols, tree: t } = controlled(minCols);
      const tree = await t;
      expect(getColumnWidths(tree)).toStrictEqual([113, 112, 113, 112, 450]);
      await resizeCol(tree, "Type", -100);
      expect(getColumnWidths(tree)).toStrictEqual([113, 100, 115, 114, 458]);
      cols.set(minCols.map((c) => (c.uid === "type" ? { ...c, minWidth: 50 } : c)));
      await flush();
      expect(getColumnWidths(tree)).toStrictEqual([113, 100, 115, 114, 458]);
      await resizeCol(tree, "Type", -100);
      expect(getColumnWidths(tree)).toStrictEqual([113, 50, 123, 123, 491]);
    });

    it("onResize end called with values even if no resizing took place", async () => {
      const onResizeEnd = vi.fn();
      const tree = await controlled(minCols, { onResizeEnd }).tree;
      expect(getColumnWidths(tree)).toStrictEqual([113, 112, 113, 112, 450]);
      await resizeCol(tree, "Type", 0);
      expect(onResizeEnd).toHaveBeenCalledWith(mapFromWidths(columnNames, [113, 112, "1fr", "1fr", "4fr"]));
      expect(getColumnWidths(tree)).toStrictEqual([113, 112, 113, 112, 450]);
    });

    it("onResize end called with values even if no resizing took place uncontrolled", async () => {
      const allowsResizing = true;
      const columns = [
        { name: "Name", id: "name", allowsResizing },
        { name: "Type", id: "type", defaultWidth: "3fr", allowsResizing },
        { name: "Level", id: "level", allowsResizing },
        { name: "Height", id: "height", defaultWidth: "5fr", allowsResizing },
      ];
      const onResizeEnd = vi.fn();
      const tree = await renderIt(() => <ResizableTable columns={columns} rows={rows} onResizeEnd={onResizeEnd} />);
      expect(getColumnWidths(tree)).toStrictEqual([90, 270, 90, 450]);
      await resizeCol(tree, "Type", 0);
      expect(getColumnWidths(tree)).toStrictEqual([90, 270, 90, 450]);
      expect(onResizeEnd).toHaveBeenCalledWith(mapFromWidths(["Name", "Type", "Level", "Height"], [90, 270, "1fr", "5fr"]));
    });

    it("onResizeStart called with expected values", async () => {
      const onResizeStart = vi.fn();
      const tree = await controlled(frCols, { onResizeStart }).tree;
      expect(getColumnWidths(tree)).toStrictEqual([113, 112, 113, 112, 450]);
      await resizeCol(tree, "Height", -50);
      expect(onResizeStart).toHaveBeenCalledTimes(1);
      expect(onResizeStart).toHaveBeenCalledWith(mapFromWidths(columnNames, [113, 112, 113, "1fr", "4fr"]));
    });
  });

  describe("resizing table", () => {
    const tableOf = async (columns: any[]) => controlled2(columns);
    const controlled2 = (columns: any[]) => renderIt(() => <ControlledResizableTable columns={() => columns} />);
    it("will not affect pixel widths", async () => {
      const tree = await tableOf([
        { name: "Name", uid: "name", width: 100 },
        { name: "Type", uid: "type", width: 100 },
        { name: "Height", uid: "height" },
        { name: "Weight", uid: "weight" },
        { name: "Level", uid: "level", width: 400 },
      ]);
      expect(getColumnWidths(tree)).toStrictEqual([100, 100, 150, 150, 400]);
      await resizeTable(tree, 1000);
      expect(getColumnWidths(tree)).toStrictEqual([100, 100, 200, 200, 400]);
    });
    it("will resize all percent columns", async () => {
      const tree = await tableOf([
        { name: "Name", uid: "name", width: "20%" },
        { name: "Type", uid: "type", width: "20%" },
        { name: "Height", uid: "height" },
        { name: "Weight", uid: "weight" },
        { name: "Level", uid: "level", width: "40%" },
      ]);
      expect(getColumnWidths(tree)).toStrictEqual([180, 180, 90, 90, 360]);
      await resizeTable(tree, 1000);
      expect(getColumnWidths(tree)).toStrictEqual([200, 200, 100, 100, 400]);
    });
    it("will resize all fr columns", async () => {
      const tree = await tableOf([
        { name: "Name", uid: "name", width: "1fr" },
        { name: "Type", uid: "type", width: "1fr" },
        { name: "Height", uid: "height" },
        { name: "Weight", uid: "weight" },
        { name: "Level", uid: "level", width: "4fr" },
      ]);
      expect(getColumnWidths(tree)).toStrictEqual([113, 112, 113, 112, 450]);
      await resizeTable(tree, 1000);
      expect(getColumnWidths(tree)).toStrictEqual([125, 125, 125, 125, 500]);
    });
    it("will resize all fr columns only after percent columns", async () => {
      const tree = await tableOf([
        { name: "Name", uid: "name", width: "1fr" },
        { name: "Type", uid: "type", width: "20%" },
        { name: "Height", uid: "height", width: "20%" },
        { name: "Weight", uid: "weight" },
        { name: "Level", uid: "level", width: "4fr" },
      ]);
      expect(getColumnWidths(tree)).toStrictEqual([90, 180, 180, 90, 360]);
      await resizeTable(tree, 1000);
      expect(getColumnWidths(tree)).toStrictEqual([100, 200, 200, 100, 400]);
    });
  });

  // Rivet addition: pointer resizing with uncontrolled widths (the upstream interaction cases use the
  // controlled table, whose widths flow back through a `columns` signal).
  it("resizes an uncontrolled column with the pointer", async () => {
    const onResize = vi.fn();
    const onResizeEnd = vi.fn();
    const columns = [
      { name: "Name", id: "name", allowsResizing: true },
      { name: "Type", id: "type", allowsResizing: true },
      { name: "Level", id: "level", allowsResizing: true },
    ];
    const tree = await renderIt(() => <ResizableTable columns={columns} rows={rows} onResize={onResize} onResizeEnd={onResizeEnd} />);
    expect(getColumnWidths(tree)).toStrictEqual([300, 300, 300]);
    await resizeCol(tree, "Name", -50);
    expect(getColumnWidths(tree)).toStrictEqual([250, 325, 325]);
    expect(onResize).toHaveBeenCalledWith(
      new Map<string, unknown>([
        ["name", 250],
        ["type", "1fr"],
        ["level", "1fr"],
      ]),
    );
    expect(onResizeEnd).toHaveBeenCalledTimes(1);
  });

  // Rivet addition: keyboard resizing (column header → resizer input via focusMode "child", Enter starts,
  // arrows move by 10px, Enter ends; focus stays on the resizer that was focused when resizing started).
  it("resizes with the keyboard", async () => {
    const user = userEvent.setup({ delay: null });
    const onResizeEnd = vi.fn();
    const columns = [
      { name: "Name", id: "name", defaultWidth: 200, allowsResizing: true },
      { name: "Type", id: "type" },
    ];
    const tree = await renderIt(() => <ResizableTable columns={columns} rows={rows} onResizeEnd={onResizeEnd} />);
    await user.tab();
    await user.keyboard("{ArrowUp}");
    await frame();
    expect(document.activeElement).toBe(within(getColumn(tree, "Name")).getByRole("slider"));
    await user.keyboard("{Enter}");
    expect(getColumn(tree, "Name")).toHaveAttribute("data-resizing", "true");
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{Enter}");
    await flush();
    expect(getColumnWidths(tree)).toStrictEqual([220, 680]);
    expect(onResizeEnd).toHaveBeenCalledWith(
      new Map<string, unknown>([
        ["name", 220],
        ["type", "1fr"],
      ]),
    );
    expect(getColumn(tree, "Name")).not.toHaveAttribute("data-resizing");
    expect(document.activeElement).toBe(within(getColumn(tree, "Name")).getByRole("slider"));
  });

  it("Column resizer accepts data attributes", async () => {
    const tree = await renderIt(() => <ControlledResizableTable />);
    expect(tree.getAllByTestId("resizer")).toHaveLength(5);
  });
});
