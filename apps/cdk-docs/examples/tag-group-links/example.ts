import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TagGroup links",
  summary: "Tags with href: the row stays a div[role=row] carrying data-href / data-target; a press or Enter opens the link through the router.",
  tags: ["tag-group", "links"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#photo-links div[role=row][data-key=landscape]" },
    { attr: ["#photo-links [data-key=landscape]", "data-href", "https://en.wikipedia.org/wiki/Landscape_photography"] },
    { attr: ["#photo-links [data-key=landscape]", "data-target", "_blank"] },
    { absent: "#photo-links a" },
    { press: ["#photo-links [data-key=landscape]", "ArrowRight"] },
    { focused: "#photo-links [data-key=portrait]" },
    { key: "End" },
    { focused: "#photo-links [data-key=night]" },
  ],
});
