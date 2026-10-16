import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tooltip events",
  summary:
    "onOpenChange on TooltipTrigger, the trigger's own press and focus events chained with the tooltip's, global DOM props and data-* on the Tooltip and the OverlayArrow.",
  tags: ["tooltip", "events", "dom"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { key: "Tab" },
    { matches: "#te" },
    { expect: ["#te-log", "button:focus open"] },
    { attr: ["#te", "lang", "nl"] },
    { attr: ["#te", "data-tone", "info"] },
    { attr: ["#te > .rv-OverlayArrow", "lang", "sv"] },
    { attr: ["#te > .rv-OverlayArrow", "data-part", "arrow"] },
    { key: "Escape" },
    { absent: "#te" },
    { expect: ["#te-log", "button:focus open close"] },
    // A press runs the Button's onPress and closes the tooltip (shouldCloseOnPress).
    { press: ["#te-next", "Shift+Tab"] },
    { matches: "#te" },
    { expect: ["#te-log", "close button:blur button:focus open"] },
    { key: "Enter" },
    { absent: "#te" },
    { expect: ["#te-log", "button:focus open close button:press"] },
  ],
});
