import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "HoloCard: Image Only",
  summary: "One piece of art as the whole card face: no content layers, the texture and the glare blend over the image.",
  tags: ["holo-card"],
  status: "experimental",
  frame: { height: 500 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#hc-image-only .holo-card__image[alt]",
    },
    {
      absent: "#hc-image-only .holo-card__content",
    },
    {
      hover: "#hc-image-only",
    },
    {
      attr: ["#hc-image-only", "data-active", "true"],
    },
  ],
});
