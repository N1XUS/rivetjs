import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Motion: Modal exit",
  summary:
    "Rivet addition: Motion elements inside a Modal play their exit when it closes, and the modal waits for them. No Presence wrapper: the overlay is the presence.",
  tags: ["motion", "modal", "presence"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "#open" }, { matches: "#panel" }, { click: "#close" }, { absent: "#panel" }],
});
