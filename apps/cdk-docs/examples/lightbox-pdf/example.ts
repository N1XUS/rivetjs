import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Lightbox PDF slide",
  summary:
    "A PDF slide opens in the browser's own PDF viewer (an object element, no pdf.js); where the browser has no viewer, a download link takes its place.",
  tags: ["lightbox", "tailwind", "pdf"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#open" },
    { attr: ["[data-lightbox-slide][data-current] object", "type", "application/pdf"] },
    { key: "Escape" },
    { absent: "[role=dialog]" },
  ],
});
