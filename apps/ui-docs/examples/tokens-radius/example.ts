import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tokens: radius",
  summary:
    "The radius scale (every step is a multiple of --radius) and concentric radii: a Card's inner image and corner Button take the card radius minus its padding (--r-inner). Values are read from the live CSS.",
  tags: ["tokens", "radius", "theme", "card"],
  status: "experimental",
  frame: { height: 520, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["[data-value='--radius']", "rem"] }, { expect: ["[data-value='rounded-lg']", "px"] }, { expect: ["[data-value='inner']", "px"] }],
});
