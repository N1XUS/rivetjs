import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Forwarding DOM events and attributes",
  summary: "Global DOM events and attributes on a Button and on the Tabs parts (TabList, Tab, TabPanel): each lands on its own element.",
  tags: ["cdk", "dom-props"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#save", "lang", "en-GB"] },
    { attr: ["#save", "dir", "ltr"] },
    { click: "#save" },
    { expect: ["#log", "save:enter"] },
    // onClick is owned by Button: its press runs first, then yours.
    { expect: ["#log", "save:press save:click"] },
    { attr: ['[role="tablist"]', "translate", "no"] },
    { attr: ['[data-key="fr"]', "lang", "fr"] },
    { attr: ['[role="tabpanel"]', "lang", "en"] },
    { click: '[data-key="fr"]' },
    { expect: ["#log", "list:enter"] },
    { expect: ["#log", "tab:fr:down"] },
    { attr: ['[data-key="fr"]', "aria-selected", "true"] },
    { attr: ['[role="tabpanel"]', "lang", "fr"] },
  ],
});
