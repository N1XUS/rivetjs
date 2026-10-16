import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "createAsyncList",
  summary:
    "createAsyncList over a fake paged loader: initial load, loadMore with a cursor, client-side sort, server-side filtering and reload, with loadingState.",
  tags: ["data", "async", "list", "listbox"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx"],
  test: [
    // The initial load runs in the browser after mount.
    { expect: ["#planets-state", "idle"] },
    { expect: ["#planets-option-mercury", "Mercury"] },
    { absent: "#planets-option-jupiter" },
    { expect: ["#planets-count", "4 loaded"] },
    // loadMore: the next page (cursor 4).
    { click: "#planets-more" },
    { expect: ["#planets-option-neptune", "Neptune"] },
    { expect: ["#planets-count", "8 loaded"] },
    // sort: a client-side sort function over the loaded items.
    { click: "#planets-sort" },
    { matches: "#planets > [role=option]:first-child#planets-option-earth" },
    { expect: ["#planets-sort-state", "name ascending"] },
    // setFilterText: load() runs again with filterText (server-side filtering).
    { fill: ["#planets-filter", "ur"] },
    { expect: ["#planets-count", "3 loaded"] },
    { expect: ["#planets-option-saturn", "Saturn"] },
    { absent: "#planets-option-earth" },
    // reload: back to the first page of the current filter.
    { click: "#planets-reload" },
    { expect: ["#planets-state", "idle"] },
    { expect: ["#planets-option-mercury", "Mercury"] },
  ],
});
