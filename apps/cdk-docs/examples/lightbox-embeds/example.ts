import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Lightbox YouTube, Vimeo and iframe embeds",
  summary:
    "Embed slides show a poster until they are the current slide; only then the privacy-friendly youtube-nocookie iframe is created, and leaving the slide removes it.",
  tags: ["lightbox", "tailwind", "embed", "iframe"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#open" },
    { matches: "[data-lightbox-slide][data-index='1'] img" },
    // The neighbour shows its poster; no request to YouTube until the embed slide is current (the check never opens it:
    // the player keeps the network busy). Mounting / unmounting the iframe: libs/cdk/tests-components/lightbox.test.ts.
    { absent: "iframe" },
  ],
});
