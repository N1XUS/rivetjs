import { signal } from "@rivetjs/reactivity";
import { Collection } from "@rivetjs/cdk/collections/components";
import { GridList, GridListItem } from "@rivetjs/cdk/grid-list";
import { Header } from "@rivetjs/cdk/header";
import { ListBox, ListBoxItem, ListBoxSection } from "@rivetjs/cdk/listbox";
import { Menu, MenuItem } from "@rivetjs/cdk/menu";
import { Cell, Column, Row, Table, TableBody, TableHeader } from "@rivetjs/cdk/table";
import { Tree, TreeItem, TreeItemContent } from "@rivetjs/cdk/tree";
import type { Key, Selection } from "@rivetjs/cdk/types";
import { ListLayout, TableLayout, CollectionVirtualizer } from "@rivetjs/cdk/virtualizer";

export const head = { title: "Virtualized collections" };

interface Person {
  id: number;
  name: string;
  role: string;
}

const PEOPLE: Person[] = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, name: `Person ${i + 1}`, role: ["Engineer", "Designer", "Manager"][i % 3]! }));

interface Group {
  id: string;
  name: string;
  people: Person[];
}

// 20 sections of 50 people (keys `g<section>-<n>`).
const GROUPS: Group[] = Array.from({ length: 20 }, (_, g) => ({
  id: `g${g + 1}`,
  name: `Group ${g + 1}`,
  people: Array.from({ length: 50 }, (_, i) => ({ id: `g${g + 1}-${i + 1}` as never, name: `Member ${g + 1}.${i + 1}`, role: "" })),
}));

interface Folder {
  id: string;
  name: string;
  files: { id: string; name: string }[];
}

// 100 expanded folders of 9 files: 1000 rows.
const FOLDERS: Folder[] = Array.from({ length: 100 }, (_, f) => ({
  id: `f${f + 1}`,
  name: `Folder ${f + 1}`,
  files: Array.from({ length: 9 }, (_, i) => ({ id: `f${f + 1}-${i + 1}`, name: `File ${f + 1}.${i + 1}` })),
}));

const listed = (selection: Selection) => (selection === "all" ? "all" : [...selection].map(String).join(",") || "none");

export default function VirtualizedCollectionsStory() {
  const picked = signal<Selection>(new Set<Key>());
  const rows = signal<Selection>(new Set<Key>());
  const members = signal<Selection>(new Set<Key>());
  const cards = signal<Selection>(new Set<Key>());
  const action = signal("none");
  const files = signal<Selection>(new Set<Key>());
  return (
    <section>
      <h1>Virtualized collections</h1>
      <CollectionVirtualizer layout={ListLayout} layoutOptions={{ rowHeight: 32 }} initialSize={{ width: 240, height: 320 }}>
        <ListBox
          id="vlist"
          aria-label="People"
          items={PEOPLE}
          selectionMode="multiple"
          selectedKeys={picked}
          onSelectionChange={(keys) => picked.set(keys)}
          style={{ display: "block", width: "240px", height: "320px", overflow: "auto" }}
        >
          {(person: Person) => (
            <ListBoxItem id={person.id} textValue={person.name} style={{ height: "32px", "box-sizing": "border-box" }}>
              {person.name}
            </ListBoxItem>
          )}
        </ListBox>
      </CollectionVirtualizer>
      <p id="vlist-value">{listed(picked())}</p>
      <CollectionVirtualizer layout={TableLayout} layoutOptions={{ rowHeight: 32, headingHeight: 32 }} initialSize={{ width: 400, height: 320 }}>
        <Table
          id="vtable"
          aria-label="People table"
          selectionMode="multiple"
          selectedKeys={rows}
          onSelectionChange={(keys) => rows.set(keys)}
          style={{ display: "block", width: "400px", height: "320px", overflow: "auto" }}
        >
          <TableHeader>
            <Column id="name" isRowHeader>
              Name
            </Column>
            <Column id="role">Role</Column>
          </TableHeader>
          <TableBody items={PEOPLE}>
            {(person: Person) => (
              <Row id={person.id}>
                <Cell>{person.name}</Cell>
                <Cell>{person.role}</Cell>
              </Row>
            )}
          </TableBody>
        </Table>
      </CollectionVirtualizer>
      <p id="vtable-value">{listed(rows())}</p>
      <CollectionVirtualizer layout={ListLayout} layoutOptions={{ rowHeight: 32, headingHeight: 28 }} initialSize={{ width: 240, height: 320 }}>
        <ListBox
          id="vsections"
          aria-label="Groups"
          items={GROUPS}
          selectionMode="multiple"
          selectedKeys={members}
          onSelectionChange={(keys) => members.set(keys)}
          style={{ display: "block", width: "240px", height: "320px", overflow: "auto" }}
        >
          {(group: Group) => (
            <ListBoxSection id={group.id}>
              <Header style={{ height: "28px", margin: "0" }}>{group.name}</Header>
              <Collection items={group.people}>
                {(person: Person) => (
                  <ListBoxItem id={person.id} textValue={person.name} style={{ height: "32px", "box-sizing": "border-box" }}>
                    {person.name}
                  </ListBoxItem>
                )}
              </Collection>
            </ListBoxSection>
          )}
        </ListBox>
      </CollectionVirtualizer>
      <p id="vsections-value">{listed(members())}</p>
      <CollectionVirtualizer layout={ListLayout} layoutOptions={{ rowHeight: 32 }} initialSize={{ width: 240, height: 320 }}>
        <GridList
          id="vgrid"
          aria-label="People grid"
          items={PEOPLE}
          selectionMode="multiple"
          selectedKeys={cards}
          onSelectionChange={(keys) => cards.set(keys)}
          style={{ display: "block", width: "240px", height: "320px", overflow: "auto" }}
        >
          {(person: Person) => (
            <GridListItem id={person.id} textValue={person.name} style={{ height: "32px", "box-sizing": "border-box" }}>
              {person.name}
            </GridListItem>
          )}
        </GridList>
      </CollectionVirtualizer>
      <p id="vgrid-value">{listed(cards())}</p>
      <CollectionVirtualizer layout={ListLayout} layoutOptions={{ rowHeight: 32 }} initialSize={{ width: 240, height: 320 }}>
        <Menu
          id="vmenu"
          aria-label="Actions"
          items={PEOPLE}
          onAction={(key) => action.set(String(key))}
          style={{ display: "block", width: "240px", height: "320px", overflow: "auto" }}
        >
          {(person: Person) => (
            <MenuItem id={person.id} textValue={person.name} style={{ height: "32px", "box-sizing": "border-box" }}>
              {person.name}
            </MenuItem>
          )}
        </Menu>
      </CollectionVirtualizer>
      <p id="vmenu-value">{action()}</p>
      <CollectionVirtualizer layout={ListLayout} layoutOptions={{ rowHeight: 32 }} initialSize={{ width: 240, height: 320 }}>
        <Tree
          id="vtree"
          aria-label="Files"
          items={FOLDERS}
          defaultExpandedKeys={FOLDERS.map((folder) => folder.id)}
          selectionMode="multiple"
          selectedKeys={files}
          onSelectionChange={(keys) => files.set(keys)}
          style={{ display: "block", width: "240px", height: "320px", overflow: "auto" }}
        >
          {(folder: Folder) => (
            <TreeItem id={folder.id} textValue={folder.name} style={{ height: "32px", "box-sizing": "border-box" }}>
              <TreeItemContent>{folder.name}</TreeItemContent>
              <Collection items={folder.files}>
                {(file: { id: string; name: string }) => (
                  <TreeItem id={file.id} textValue={file.name} style={{ height: "32px", "box-sizing": "border-box" }}>
                    <TreeItemContent>{file.name}</TreeItemContent>
                  </TreeItem>
                )}
              </Collection>
            </TreeItem>
          )}
        </Tree>
      </CollectionVirtualizer>
      <p id="vtree-value">{listed(files())}</p>
    </section>
  );
}
