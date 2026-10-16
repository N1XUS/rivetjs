import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Showcase: Pricing",
  summary:
    "A pricing page: monthly / yearly billing, a seat stepper that updates every plan's total, a highlighted plan, a comparison table that scrolls inside its card on phones, and an FAQ accordion.",
  tags: ["showcase", "card", "segment", "number-stepper", "accordion", "chip"],
  status: "experimental",
  frame: { height: 900 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#price-growth", "€24"] },
    { expect: ["#total-growth", "€72 billed monthly for 3 seats"] },
    { click: "#billing [role=radio]:last-child" },
    { expect: ["#price-growth", "€19"] },
    { expect: ["#total-studio", "€1,692 billed yearly for 3 seats"] },
    { click: "[data-slot=number-stepper-increment-button]" },
    { expect: ["#total-growth", "€912 billed yearly for 4 seats"] },
    { click: "#choose-growth" },
    { expect: ["#pricing-status", "Selected Growth, yearly, 4 seat(s): €912"] },
  ],
});
