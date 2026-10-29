import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Collection } from "@rivetjs/cdk/collections/components";
import { createTreeData, type TreeNode } from "@rivetjs/cdk/data";
import { Tree, TreeHeader, TreeItem, TreeItemContent, TreeSection } from "@rivetjs/cdk/tree";
import type { Key, Selection } from "@rivetjs/cdk/collections/types";

export const head = { title: "Tree" };

// Port of the react-aria-components Tree.ssr.test.js fixture (chevron icon → text label in this story),
// plus a selectable tree with a two-way expandedKeys signal.
const MyTreeItemContent = (props: { children?: unknown }) => (
  <TreeItemContent>
    {({ hasChildItems }: { hasChildItems: () => boolean }) => (
      <>
        <Button slot="chevron" style={{ visibility: hasChildItems() ? "visible" : "hidden" }}>
          Toggle
        </Button>
        {props.children}
      </>
    )}
  </TreeItemContent>
);

interface Person {
  id: string;
  name: string;
  children?: Person[];
}

/** createTreeData row: content reads the node's value, children through a nested Collection. */
function PersonItem(props: { node: TreeNode<Person> }) {
  const node = props.node;
  return (
    <TreeItem id={node.key} textValue={node.value.name}>
      <MyTreeItemContent>{node.value.name}</MyTreeItemContent>
      <Collection items={node.children ?? []}>{(child: TreeNode<Person>) => <PersonItem node={child} />}</Collection>
    </TreeItem>
  );
}

export default function TreeStory() {
  const people = createTreeData<Person>({
    initialItems: [
      { id: "david", name: "David", children: [{ id: "john", name: "John", children: [{ id: "sam", name: "Sam" }] }] },
      { id: "emma", name: "Emma" },
    ],
  });
  const show = signal(false);
  const expanded = signal(new Set<Key>(["fruit"]));
  const selected = signal<Selection>(new Set<Key>());
  return (
    <section>
      <h1>Tree</h1>
      <button id="tree-show" onClick={() => show.set(true)}>
        Show
      </button>
      <Tree id="tree-files" aria-label="Files" style={{ height: "300px" }} defaultExpandedKeys={["documents", "photos", "project"]}>
        <TreeItem id="documents" textValue="Documents">
          <MyTreeItemContent>Documents</MyTreeItemContent>
          <TreeItem id="project" textValue="Project">
            <MyTreeItemContent>Project</MyTreeItemContent>
            {show() && (
              <TreeItem id="report" textValue="Weekly Report">
                <MyTreeItemContent>Weekly Report</MyTreeItemContent>
              </TreeItem>
            )}
          </TreeItem>
        </TreeItem>
        <TreeItem id="photos" textValue="Photos">
          <MyTreeItemContent>Photos</MyTreeItemContent>
          <TreeItem id="one" textValue="Image 1">
            <MyTreeItemContent>Image 1</MyTreeItemContent>
          </TreeItem>
          <TreeItem id="two" textValue="Image 2">
            <MyTreeItemContent>Image 2</MyTreeItemContent>
          </TreeItem>
        </TreeItem>
      </Tree>
      <Tree id="tree-food" aria-label="Food" selectionMode="multiple" expandedKeys={expanded} selectedKeys={selected}>
        <TreeItem id="fruit" textValue="Fruit">
          <MyTreeItemContent>Fruit</MyTreeItemContent>
          <TreeItem id="apple" textValue="Apple">
            <MyTreeItemContent>Apple</MyTreeItemContent>
          </TreeItem>
          <TreeItem id="pear" textValue="Pear">
            <MyTreeItemContent>Pear</MyTreeItemContent>
          </TreeItem>
        </TreeItem>
        <TreeItem id="veg" textValue="Vegetables">
          <MyTreeItemContent>Vegetables</MyTreeItemContent>
          <TreeItem id="leek" textValue="Leek">
            <MyTreeItemContent>Leek</MyTreeItemContent>
          </TreeItem>
        </TreeItem>
      </Tree>
      <Tree id="tree-sections" aria-label="Sections">
        <TreeSection id="sec-fruit">
          <TreeHeader>Fruit</TreeHeader>
          <TreeItem id="sec-apple" textValue="Apple">
            <MyTreeItemContent>Apple</MyTreeItemContent>
          </TreeItem>
          <TreeItem id="sec-pear" textValue="Pear">
            <MyTreeItemContent>Pear</MyTreeItemContent>
          </TreeItem>
        </TreeSection>
        <TreeSection id="sec-veg" aria-label="Vegetables">
          <TreeItem id="sec-leek" textValue="Leek">
            <MyTreeItemContent>Leek</MyTreeItemContent>
          </TreeItem>
        </TreeSection>
      </Tree>
      <Tree id="tree-people" aria-label="People" items={people.items} defaultExpandedKeys={["david", "john"]}>
        {(node: TreeNode<Person>) => <PersonItem node={node} />}
      </Tree>
      <button
        id="people-rename"
        onClick={() => {
          const node = people.getItem("sam");
          if (node) people.update("sam", { ...node.value, name: node.value.name + " (renamed)" });
        }}
      >
        Rename
      </button>
      <button id="people-remove" onClick={() => people.remove("emma")}>
        Remove
      </button>
      <button id="people-root" onClick={() => people.move("john", null, 0)}>
        Move John to root
      </button>
      <output id="tree-food-expanded">{[...expanded()].join(",")}</output>
      <output id="tree-food-selected">{[...selected()].join(",")}</output>
    </section>
  );
}
