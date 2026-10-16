import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtual scroll: autosize",
  summary:
    "The autosize strategy (cdk-experimental) renders items of unknown height: it measures rendered rows and estimates the rest; CdkVirtualForOf renders rows inside a <ul>, keyed by trackBy.",
  tags: ["scrolling", "virtual scroll", "autosize"],
  status: "experimental",
  frame: { height: 332, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Server: 50px estimate per row; a 240px viewport + 100px minimum buffer.
    { matches: '#messages li[data-id="m0"]' },
    { absent: '#messages li[data-id="m40"]' },
    { attr: ["#messages ul", "role", "list"] },
    // Wake the engine with a scroll (see "Known limitations" on the page), then keys work.
    { click: "#messages-jump" },
    { absent: '#messages li[data-id="m0"]' },
    { matches: '#messages li[data-id="m60"]' },
    { press: ["#messages", "End"] },
    { matches: '#messages li[data-id="m499"]' },
    { click: "#messages-top" },
    { matches: '#messages li[data-id="m0"]' },
  ],
});
