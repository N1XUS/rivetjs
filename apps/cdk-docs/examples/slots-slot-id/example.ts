import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slots: createSlotId",
  summary: "An optional description part: aria-describedby points at it only while it renders (createSlotId + slotIdRef), on the server and after resume.",
  tags: ["slots", "slot-id", "aria-describedby"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#sid-group", "aria-describedby", "sid-desc"] },
    { click: "#sid-toggle" },
    { absent: "#sid-desc" },
    { attr: ["#sid-group", "aria-describedby", null] },
    { click: "#sid-toggle" },
    { described: ["#sid-group", "Pick one option"] },
  ],
});
