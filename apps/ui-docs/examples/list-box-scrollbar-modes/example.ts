import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBox: Scrollbar Modes",
  summary: 'ListBox demo "Scrollbar Modes": `data-scrollbar` set to thin, default and none around a scrolling list.',
  tags: ["list-box", "scrollbar"],
  status: "experimental",
  frame: { height: 320, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "[data-scrollbar=thin] [role=listbox]" },
    { matches: "[data-scrollbar=default] [role=listbox]" },
    { matches: "[data-scrollbar=none] [role=listbox]" },
    { click: '[data-scrollbar=none] [role=option][data-key="none-bear"]' },
    { attr: ['[data-scrollbar=none] [role=option][data-key="none-bear"]', "aria-selected", "true"] },
  ],
});
