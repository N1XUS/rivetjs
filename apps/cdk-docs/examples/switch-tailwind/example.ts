import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Switch with Tailwind",
  summary: "A Switch drawn as a track and thumb: group on the label, group-data-[selected]:, -[pressed]:, -[focus-visible]: and data-[disabled]: variants.",
  tags: ["switch", "tailwind", "styling"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "label.group:has(#tw-sw)" },
    { click: "label:has(#tw-sw)" },
    { matches: "#tw-sw:checked" },
    { matches: "label[data-selected]:has(#tw-sw)" },
    { matches: "label[data-disabled][data-selected]:has(#tw-managed)" },
  ],
});
