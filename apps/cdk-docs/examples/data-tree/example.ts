import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "createTreeData",
  summary: "A Tree over createTreeData: append a child to the selected node, move the node with its children to the root.",
  tags: ["data", "tree"],
  status: "experimental",
  frame: { height: 234, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#people-david", "aria-level", "1"] },
    { attr: ["#people-john", "aria-level", "2"] },
    { attr: ["#people-sam", "aria-level", "3"] },
    { attr: ["#people-john", "aria-selected", "true"] },
    // append(parentKey, value): a new child of the selected node (john).
    { click: "#people-add" },
    { expect: ["#people-person-1", "Person 1"] },
    { attr: ["#people-person-1", "aria-level", "3"] },
    // move(key, null, 0): the selected node (with its children) to the root.
    { click: "#people-root" },
    { attr: ["#people-john", "aria-level", "1"] },
    { attr: ["#people-sam", "aria-level", "2"] },
    // update(key, value): the row re-renders with the new value.
    { click: "#people-rename" },
    { expect: ["#people-sam", "Sam (renamed)"] },
    // removeSelectedItems(): john (with its children) leaves the tree.
    { click: "#people-remove" },
    { absent: "#people-john" },
    { absent: "#people-sam" },
    { expect: ["#people-emma", "Emma"] },
  ],
});
