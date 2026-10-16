import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Thumbnails",
  summary: "A thumbnail strip as the tab list, with the controls outside the viewport.",
  tags: ["carousel"],
  status: "experimental",
  frame: { height: 392, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#carousel-thumbnails [role=tab]:nth-child(3)",
    },
    {
      attr: ["#carousel-thumbnails [role=tab]:nth-child(3)", "aria-selected", "true"],
    },
  ],
});
