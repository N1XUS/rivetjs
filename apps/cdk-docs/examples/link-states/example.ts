import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Link href, current and disabled",
  summary: 'A Link with href is a plain <a> (no JavaScript); aria-current marks the current page; a disabled link renders <span role="link" aria-disabled>.',
  tags: ["link", "state"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#l-docs", "href", "#docs"] },
    { attr: ["#l-docs", "class", "rv-Link"] },
    { attr: ["#l-home", "aria-current", "page"] },
    { attr: ["#l-home", "data-current", "true"] },
    { attr: ["#l-old", "role", "link"] },
    { attr: ["#l-old", "aria-disabled", "true"] },
    { attr: ["#l-old", "data-disabled", "true"] },
    { attr: ["#l-old", "href", "#old"] },
    { attr: ["#l-old", "tabindex", null] },
    { click: "#l-docs" },
    { matches: "#l-docs:focus" },
  ],
});
