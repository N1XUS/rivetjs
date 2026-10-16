import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Popover with Tailwind",
  summary:
    "No theme: utilities on the Button and the Popover, aria-expanded: on the trigger, entering: / exiting: animations and placement-* origins from the side used.",
  tags: ["popover", "tailwind", "transition"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: "#ptw-trigger" },
    { matches: ".rounded-lg:has(#ptw-dialog)" },
    { attr: [".rounded-lg:has(#ptw-dialog)", "data-placement", "bottom"] },
    // Settled open: the entry animation finished.
    { absent: "[data-entering]" },
    { matches: "#ptw-trigger[aria-expanded=true]" },
    { key: "Escape" },
    { absent: "#ptw-dialog" },
  ],
});
