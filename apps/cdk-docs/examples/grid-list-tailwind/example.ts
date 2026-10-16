import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "GridList with Tailwind",
  summary:
    "Tailwind classes computed from the GridList and GridListItem render props (isSelected, isDisabled, isFocusVisible), with a lucide check in the selection checkbox.",
  tags: ["grid-list", "tailwind", "styling"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#animals:not(.rv-GridList)" },
    { matches: "#animals-cat.bg-white:not(.rv-GridListItem)" },
    { matches: "#animals-cat [slot=selection] svg.check" },
    { click: "#animals-cat" },
    { matches: "#animals-cat.bg-violet-600" },
    { matches: "#animals-kangaroo.text-slate-400" },
    { key: "ArrowDown" },
    { matches: "#animals-dog.ring-2" },
    { key: "ArrowDown" },
    // Kangaroo is disabled: skipped.
    { matches: "#animals-panda.ring-2" },
  ],
});
