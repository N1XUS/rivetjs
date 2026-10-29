import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Radio: Parts and States",
  summary:
    "Radio as shorthand (label + description), as composed parts, with a render function that reads isSelected, and disabled; the group value is a two-way Signal.",
  tags: ["radio", "radio-group"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#radio-shipping-value", "standard"] },
    { click: "#radio-shipping [data-slot=radio]:has(input[value=pickup]) [data-slot=radio-content]" },
    { expect: ["#radio-shipping-value", "pickup"] },
    { expect: ["#radio-shipping", "We email you when it is ready"] },
    { matches: "#radio-shipping [data-slot=radio][data-disabled]:has(input[value=drone][disabled])" },
    { press: ["#radio-shipping input[value=pickup]", "ArrowUp"] },
    { expect: ["#radio-shipping-value", "express"] },
  ],
});
