import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: shadcn API",
  summary: 'shadcn/ui\'s API demo: onApi hands over the embla API; select events drive the "Slide x of y" line.',
  tags: ["carousel", "shadcn", "events"],
  status: "experimental",
  frame: {
    height: "md",
  },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#carousel-shadcn-api-status", "Slide 1 of 5"] },
    { click: "#carousel-shadcn-api-next" },
    { expect: ["#carousel-shadcn-api-status", "Slide 2 of 5"] },
  ],
});
