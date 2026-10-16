import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ComboBox: Tailwind",
  summary: "Tailwind utilities on each part; `data-*` state variants from `@rivetjs/cdk/tailwind.css`.",
  tags: ["combobox", "tailwind", "styling"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { fill: ["#city", "l"] },
    // `class` replaces the default rv-ComboBox class; state stays in data attributes.
    { matches: 'div.grid[data-open="true"]:has(#city)' },
    { attr: ["#city", "aria-expanded", "true"] },
    { matches: '[role=listbox].outline-none [role=option].rounded[data-key="lis"]' },
    { key: "ArrowDown" },
    { matches: '[role=option].rounded[data-key="ber"][data-focused]' },
    { key: "Enter" },
    { attr: ["#city", "value", "Berlin"] },
  ],
});
