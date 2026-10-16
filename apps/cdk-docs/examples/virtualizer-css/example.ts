import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtualizer: plain CSS",
  summary:
    "Styling the default rv-Virtualizer / rv-Virtualizer-content / rv-Virtualizer-item classes and data-rv-type with plain CSS; ListLayout gap and padding space the rows.",
  tags: ["virtualizer", "css", "styling"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { matches: "#cards-list.rv-Virtualizer > .rv-Virtualizer-content > .rv-Virtualizer-item[data-rv-type='item']" },
    // String items are their own keys. padding 8 + row 32 + gap 4: the second row starts at 44px, 8px from the inline start.
    { matches: '#cards-list [data-rv-view="Card 1"]:is([style*="top:44px"], [style*="top: 44px"])' },
    { matches: '#cards-list [data-rv-view="Card 1"]:is([style*="inset-inline-start:8px"], [style*="inset-inline-start: 8px"])' },
    { matches: '#cards-list [data-rv-view="Card 1"]:is([style*="width:304px"], [style*="width: 304px"])' },
  ],
});
