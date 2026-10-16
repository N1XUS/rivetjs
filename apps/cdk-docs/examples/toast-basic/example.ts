import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toast",
  summary:
    "A ToastQueue, a ToastRegion that renders each toast, and a button that adds one: title / description slots, a close button (slot=close) with a lucide X icon, F6 into the region.",
  tags: ["toast", "notifications", "landmark"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Nothing until the first toast: no region, no toast code.
    { absent: "[role=region]" },
    { click: "#tb-add" },
    { matches: ".rv-ToastRegion[role=region]" },
    { attr: [".rv-ToastRegion", "aria-label", "1 notification."] },
    { matches: ".rv-Toast[role=alertdialog]" },
    { name: [".rv-Toast", "Files uploaded"] },
    { described: [".rv-Toast", "3 files uploaded successfully."] },
    { attr: [".rv-Toast .close", "aria-label", "Close"] },
    // Second toast; F6 moves focus into the region (a landmark).
    { click: "#tb-add" },
    { attr: [".rv-ToastRegion", "aria-label", "2 notifications."] },
    { key: "F6" },
    { focused: ".rv-ToastRegion" },
    // Closing both removes the region.
    { click: ".rv-Toast:first-child .close" },
    { attr: [".rv-ToastRegion", "aria-label", "1 notification."] },
    { click: ".rv-Toast .close" },
    { absent: "[role=region]" },
  ],
});
