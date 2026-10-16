import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Showcase: Product page",
  summary:
    "A product page: a Carousel gallery with thumbnails, swipe and a counter, colour and size choices with sold-out states, add to bag into the morphing bag pill, details in an accordion, and reviews with a rating breakdown.",
  tags: ["showcase", "carousel", "morph", "segment", "rating", "accordion", "progress-bar"],
  status: "experimental",
  frame: { height: 820 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#bag-count", "Bag is empty"] },
    { expect: ["#gallery-counter", "1 / 3"] },
    { click: "[data-slot=carousel-thumbnail]:nth-child(2)" },
    { matches: "[data-slot=carousel-thumbnail]:nth-child(2)[aria-selected=true]" },
    { expect: ["#gallery-counter", "2 / 3"] },
    { click: "[data-slot=carousel-next]" },
    { expect: ["#gallery-counter", "3 / 3"] },
    { click: "#add-to-bag" },
    { expect: ["#bag-count", "1 × US 9"] },
    { click: "#my-rating label:nth-of-type(4)" },
    { expect: ["#my-rating-text", "4 stars, thanks"] },
  ],
});
