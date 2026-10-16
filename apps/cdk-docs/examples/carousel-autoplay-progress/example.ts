import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Autoplay with a progress bar",
  summary: "embla's Autoplay example: playOnInit off, Start / Stop on the rotation control, and a progress bar restarted on every autoplay:timerset event.",
  tags: ["carousel", "autoplay", "tailwind"],
  status: "experimental",
  frame: { height: 244, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#autoplay", "data-ready", "true"] },
    { name: ["#play", "Start autoplay"] },
    { attr: ["#progress", "data-hidden", "true"] },
    { click: "#play" },
    { name: ["#play", "Stop autoplay"] },
    { expect: ["#play", "Stop"] },
  ],
});
