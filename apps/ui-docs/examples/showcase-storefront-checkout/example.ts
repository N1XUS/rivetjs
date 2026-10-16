import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Showcase: Checkout on the server",
  summary:
    "The storefront's checkout as a live page: the drawer's form posts to a server action, errors come back into the open drawer, success updates the bag in place and closes it. Without JavaScript, ?checkout opens the drawer on the server.",
  tags: ["showcase", "forms", "actions", "overlays", "drawer"],
  status: "experimental",
  mode: "server",
  frame: { height: 820 },
  show: ["src/routes/index.tsx", "src/forms/checkout.ts", "src/bag.server.ts"],
  test: [
    { expect: ["#bag-lines", "Tidewater linen shirt"] },
    { click: "#open-checkout" },
    { fill: ["#checkout-email", "rowan.ellis@example"] },
    { click: "#pay" },
    { expect: ["#checkout-email-error", "Enter an email address"] },
    { fill: ["#checkout-email", "rowan.ellis@example.com"] },
    { fill: ["#checkout-name", "Rowan Ellis"] },
    { fill: ["#checkout-address", "14 Larch Lane, Brookhaven"] },
    { fill: ["#checkout-postcode", "00000"] },
    { click: "#pay" },
    { expect: ["#checkout-postcode-error", "We do not deliver there yet"] },
    { fill: ["#checkout-postcode", "40217"] },
    { click: "#pay" },
    { expect: ["#last-order", "FN-20431"] },
  ],
});
