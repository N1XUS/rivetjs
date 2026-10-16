import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Vertical",
  summary: 'orientation="vertical": the track moves on the y axis, chevrons point up / down, the dots stack beside the viewport.',
  tags: ["carousel"],
  status: "experimental",
  frame: {
    height: "md",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#carousel-vertical-next",
    },
    {
      attr: ["#carousel-vertical [role=tab]:nth-child(2)", "aria-selected", "true"],
    },
  ],
});
