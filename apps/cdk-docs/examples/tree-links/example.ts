import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tree: links",
  summary: "Rows with href stay rows (data-href); a press or Enter opens the link through the RouterProvider navigate.",
  tags: ["tree", "links", "router"],
  status: "experimental",
  frame: { height: 114, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#pokedex-bulbasaur", "role", "row"] },
    { attr: ["#pokedex-bulbasaur", "data-href", "/pokedex/bulbasaur"] },
    { attr: ["#pokedex-bulbasaur", "aria-expanded", "true"] },
    { click: "#pokedex-ivysaur" },
    { expect: ["#pokedex-log", "navigate /pokedex/ivysaur"] },
    // The chevron expands without following the link.
    { click: "#pokedex-ivysaur-chevron" },
    { expect: ["#pokedex-venusaur", "Venusaur"] },
    { expect: ["#pokedex-log", "navigate /pokedex/ivysaur"] },
  ],
});
