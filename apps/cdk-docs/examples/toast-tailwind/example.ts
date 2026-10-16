import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toast with Tailwind",
  summary:
    "Tailwind classes on ToastRegion, Toast and the close button, styled through data-focus-visible / data-hovered variants; lucide icons per toast variant.",
  tags: ["toast", "tailwind", "styling"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: "#tw-success" },
    { matches: "[role=alertdialog][data-variant=success]" },
    { click: "#tw-error" },
    { matches: "[role=alertdialog][data-variant=error]" },
    { attr: ["[role=region]", "aria-label", "2 notifications."] },
    { key: "F6" },
    { focused: "[role=region]" },
    { key: "Tab" },
    { matches: "[role=alertdialog][data-focus-visible]" },
  ],
});
