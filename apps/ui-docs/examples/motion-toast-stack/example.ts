import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Motion: Notification stack",
  summary:
    "Rivet addition: a notification stack on PresenceFor: new cards slide in at the top while the others move down (animateLayout), dismissed ones slide out while the cards below move up into the gap.",
  tags: ["motion", "presence", "layout"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#note-1" }, { click: "#add" }, { matches: "#note-3" }, { click: "#dismiss-1" }, { absent: "#note-1" }],
});
