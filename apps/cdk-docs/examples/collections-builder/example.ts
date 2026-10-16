import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Building collections",
  summary:
    "CollectionBuilder with static Item and Section elements and a dynamic section, as a ListCollection: keys, node types, levels, getKeyAfter / getKeyBefore.",
  tags: ["collections", "react-stately"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#keys li:nth-child(1)", 'first: item "First" level 0, parent -'] },
    // Without a key: "$.<index>".
    { expect: ["#keys li:nth-child(2)", '$.1: item "No key" level 0'] },
    { expect: ["#keys li:nth-child(3)", 'fruit: section "" level 0'] },
    // Dynamic items take their key from item.id (or item.key).
    { expect: ["#keys li:nth-child(4)", 'apple: item "Apple" level 0, parent fruit'] },
    { expect: ["#counts", "size 5, items 4, section children apple, kiwi"] },
    { expect: ["#current", "first"] },
    { click: "#next" },
    { expect: ["#current", "$.1"] },
    { click: "#next" },
    { expect: ["#current", "fruit"] },
    { click: "#next" },
    { expect: ["#current", "apple"] },
    { click: "#prev" },
    { expect: ["#current", "fruit"] },
  ],
});
