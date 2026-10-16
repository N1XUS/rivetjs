import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "GridList: infinite loading",
  summary: "GridListLoadMoreItem after the rows: its sentinel calls onLoadMore as it scrolls near the viewport, and its content shows while isLoading.",
  tags: ["grid-list", "loading", "async"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#pokedex-8", "Pokémon #8"] },
    { absent: "#pokedex-9" },
    { wheel: ["#pokedex", 400] },
    { expect: ["#pokedex-9", "Pokémon #9"] },
    { wheel: ["#pokedex", 800] },
    { expect: ["#pokedex-24", "Pokémon #24"] },
  ],
});
