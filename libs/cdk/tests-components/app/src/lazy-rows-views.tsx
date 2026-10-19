// Lazy collection rows (LAZY-ROWS T3, spec docs/design/specs/2026-10-19-lazy-collection-rows-design.md §3.1 / §5):
// every cdk collection row kind with `count` rows — ListBox (section + options), GridList (section + rows), Menu
// (section + items), Table (rows + cells), Tree (expanded parent + items). `seeded` renders each collection row in its
// own id scope with the lazy `For`'s seeding contract (LAZY-ROWS T4, `libs/runtime/docs/resume.md` "Id seeding
// contract": `_inIdScope({ prefix: _rowIdPrefix(forId, k), n: 0 }, row)`; the parent's position stands in for the For's
// resume id, so no runtime hook is needed): the route renders it on the server, the test mounts it in the browser and
// compares.
import { provide } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { _inIdScope, _rowIdPrefix, withIdScope } from "@rivetjs/runtime/id";
import {
  CollectionRendererContext,
  DefaultCollectionRenderer,
  renderNodeAt,
  resolveCollection,
  type CollectionBranchProps,
  type CollectionInput,
  type CollectionRenderer,
  type CollectionRootProps,
} from "@rivetjs/cdk/collections/components";
import { GridList, GridListHeader, GridListItem, GridListSection } from "@rivetjs/cdk/grid-list";
import { Header } from "@rivetjs/cdk/header";
import { ListBox, ListBoxItem, ListBoxSection } from "@rivetjs/cdk/listbox";
import { Menu, MenuItem, MenuSection } from "@rivetjs/cdk/menu";
import { Cell, Column, Row, Table, TableBody, TableHeader } from "@rivetjs/cdk/table";
import { Text } from "@rivetjs/cdk/text";
import { Tree, TreeItem, TreeItemContent } from "@rivetjs/cdk/tree";
import type { Key, Node } from "@rivetjs/cdk/collections/types";

/** The row's seed (`rvr<for>_<index>_`): the parent node's position + 1 (0 = root rows) stands in for the For id. */
const seed = (parent: Node<unknown> | null, index: number): string => _rowIdPrefix(parent ? parent.index + 1 : 0, index);

/** Server: the row renders now; browser: `renderNodeAt` returns a region, run inside a fresh seeded scope on every read. */
function seeded(prefix: string, row: () => unknown): unknown {
  const value = _inIdScope({ prefix, n: 0 }, row);
  return typeof value === "function" ? () => _inIdScope({ prefix, n: 0 }, () => (value as () => unknown)()) : value;
}

function seededRows(collection: CollectionInput, parent: Node<unknown> | null): unknown {
  const each = (): readonly Key[] => {
    const c = resolveCollection(collection)!;
    const keys: Key[] = [];
    for (const n of parent ? c.getChildren!(parent.key) : c) if (n.type !== "content") keys.push(n.key);
    return keys;
  };
  return (
    <For each={each} by={(key: Key) => key}>
      {(key: () => Key, index: () => number) => seeded(seed(parent, index()), () => renderNodeAt(() => resolveCollection(collection), key)) as never}
    </For>
  );
}

export interface ViewsProps {
  /** Rows per collection. */
  count: number;
  /** Id prefix of the elements (`lr` server route, `lc` browser copy). */
  prefix: string;
  /** Render each collection row in its seeded id scope. */
  seeded?: boolean;
}

/** One collection per row kind, `count` rows each. */
export function LazyRowsViews(props: ViewsProps) {
  const { count, prefix } = props;
  const names = Array.from({ length: count }, (_, i) => "Item " + (i + 1));
  const views = () => (
    <div>
      <ListBox id={prefix + "-listbox"} aria-label="ListBox rows" selectionMode="multiple">
        <ListBoxSection id="s">
          <Header>Items</Header>
          {names.map((name, i) => (
            <ListBoxItem id={"o" + i} textValue={name}>
              <Text slot="label">{name}</Text>
              <Text slot="description">{name} description</Text>
            </ListBoxItem>
          ))}
        </ListBoxSection>
      </ListBox>
      <GridList id={prefix + "-gridlist"} aria-label="GridList rows" selectionMode="multiple">
        <GridListSection id="s">
          <GridListHeader>Items</GridListHeader>
          {names.map((name, i) => (
            <GridListItem id={"g" + i} textValue={name}>
              {name}
              <Text slot="description">{name} description</Text>
            </GridListItem>
          ))}
        </GridListSection>
      </GridList>
      <Menu id={prefix + "-menu"} aria-label="Menu rows">
        <MenuSection id="s">
          <Header>Items</Header>
          {names.map((name, i) => (
            <MenuItem id={"m" + i} textValue={name}>
              <Text slot="label">{name}</Text>
              <Text slot="description">{name} description</Text>
            </MenuItem>
          ))}
        </MenuSection>
      </Menu>
      <Table id={prefix + "-table"} aria-label="Table rows" selectionMode="multiple">
        <TableHeader>
          <Column isRowHeader>Name</Column>
          <Column>Index</Column>
        </TableHeader>
        <TableBody>
          {names.map((name, i) => (
            <Row id={"r" + i}>
              <Cell>{name}</Cell>
              <Cell>{String(i)}</Cell>
            </Row>
          ))}
        </TableBody>
      </Table>
      <Tree id={prefix + "-tree"} aria-label="Tree rows" selectionMode="multiple" defaultExpandedKeys={["t"]}>
        <TreeItem id="t" textValue="Items">
          <TreeItemContent>Items</TreeItemContent>
          {names.map((name, i) => (
            <TreeItem id={"t" + i} textValue={name}>
              <TreeItemContent>{name}</TreeItemContent>
            </TreeItem>
          ))}
        </TreeItem>
      </Tree>
    </div>
  );
  if (!props.seeded) return views();
  // `DefaultCollectionRenderer` with seeded rows (live hosts — Menu — render their content in place, as the default).
  const renderer: CollectionRenderer = {
    CollectionRoot: (root: CollectionRootProps) => (root.collection ? seededRows(root.collection, null) : DefaultCollectionRenderer.CollectionRoot(root)),
    CollectionBranch: (branch: CollectionBranchProps) =>
      branch.collection ? seededRows(branch.collection, branch.parent) : DefaultCollectionRenderer.CollectionBranch(branch),
  };
  return withIdScope(prefix + "-ids", () => provide(CollectionRendererContext, renderer, views));
}
