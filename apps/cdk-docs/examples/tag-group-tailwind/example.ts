import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TagGroup with Tailwind",
  summary:
    "Tailwind classes computed from the TagList and Tag render props (isSelected, isFocusVisible), a lucide check rendered from the isSelected render prop of the Tag children function, and a lucide remove icon.",
  tags: ["tag-group", "tailwind", "styling"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#filters [data-key=bug].bg-violet-600:not(.rv-Tag)" },
    { matches: "#filters [data-key=bug][aria-selected=true] svg.selected-mark" },
    { absent: "#filters [data-key=open] svg.selected-mark" },
    { click: "#filters [data-key=docs] button" },
    { absent: "#filters [data-key=docs]" },
    { click: "#filters [data-key=open]" },
    { matches: "#filters [data-key=open].bg-violet-600" },
    { matches: "#filters [data-key=open][aria-selected=true] svg.selected-mark" },
    { key: "ArrowRight" },
    { matches: "#filters [data-key=bug].ring-2" },
    { key: "Delete" },
    { absent: "#filters [data-key=open]" },
    { absent: "#filters [data-key=bug]" },
  ],
});
