import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Lightbox: Video, embed and PDF",
  summary:
    "Lightbox.Media renders each slide by type: an image, a native video, a YouTube embed (iframe created only while its slide is current, poster before) and a PDF in the browser's viewer.",
  tags: ["lightbox", "video", "embed", "pdf"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#open-media" },
    { matches: "[data-lightbox-slide][data-current] video" },
    // The embed neighbour shows its poster: no request to YouTube until its slide is current (the check never opens it).
    { absent: "iframe" },
    { click: "[data-action=prev]" },
    { matches: "[data-lightbox-slide][data-current] object[type='application/pdf']" },
  ],
});
