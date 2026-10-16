import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Server-rendered portal",
  summary:
    "A Portal rendered on the server: its content is in the HTML in place (visible without JavaScript), then moved to its mount at load; mount takes a CSS selector.",
  tags: ["portal", "ssr"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    // After load: moved out of the card into #banner-slot (a selector resolves in the browser).
    { matches: "#banner-slot > [data-rivet-portal].banner-host > #banner" },
    { absent: "#ps-card #banner" },
    { expect: ["#banner", "Free shipping this week"] },
    { click: "#banner-close" },
    { absent: "#banner" },
  ],
});
