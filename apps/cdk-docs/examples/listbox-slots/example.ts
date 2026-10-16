import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBox render slots",
  summary: "Option content as a render function with item render props (isSelected), textValue for typeahead, items as an accessor and renderEmptyState.",
  tags: ["listbox", "slots"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#team-option-alan svg" },
    { expect: ["#team-option-ada", "Mathematician"] },
    { click: "#team-option-ada" },
    { matches: "#team-option-ada svg" },
    { attr: ["#team-option-ada", "aria-selected", "true"] },
    // textValue drives typeahead: "g" finds Grace.
    { key: "g" },
    { focused: "#team-option-grace" },
    // Filtering through the items accessor; the empty state replaces the options.
    { fill: ["#filter", "b"] },
    { absent: "#fruit-option-apple" },
    { matches: "#fruit-option-banana" },
    { fill: ["#filter", "kiwi"] },
    { attr: ["#fruit", "data-empty", "true"] },
    { expect: ["#fruit .rv-ListBox-empty", "No fruit matches"] },
  ],
});
