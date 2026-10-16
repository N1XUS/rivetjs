import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Lightbox custom slides",
  summary: "The carousel's render function draws any slide type: here a custom quote slide sits between two photos.",
  tags: ["lightbox", "tailwind", "custom"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#open" },
    { expect: ["[data-lightbox-slide][data-current] #quote", "Simplicity"] },
    { key: "ArrowRight" },
    { attr: ["[data-lightbox-slide][data-current] img", "alt", "Cactus in a terracotta pot"] },
  ],
});
