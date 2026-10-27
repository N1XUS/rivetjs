import { defineExample } from "@rivetjs/docs-kit/define.ts";

// The docs home's product shot embeds this page (site.config.ts `frameMeters`): its Component / Server HTML tabs show
// this file and this page's server markup, and the pane footer shows the JS this page fetched.
export default defineExample({
  title: "Counter with Rivet UI buttons",
  summary: "A signal and two Rivet UI buttons. The server renders the page; the browser loads the counter's code on the first press.",
  tags: ["signals", "events", "resume", "ui"],
  frame: { height: 256 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: [".counter output", "0"] },
    { click: ".counter button:first-of-type" },
    { expect: [".counter output", "1"] },
    { click: ".counter button:last-of-type" },
    { expect: [".counter output", "0"] },
  ],
});
