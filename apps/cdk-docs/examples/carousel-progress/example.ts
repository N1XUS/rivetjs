import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Scroll progress",
  summary: "embla's Progress example: a bar bound to the carousel state's scrollProgress, updated on every scroll frame of a drag-free carousel.",
  tags: ["carousel", "progress", "tailwind"],
  status: "experimental",
  frame: { height: 244, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ matches: '#progress-bar[style*="translate3d(0%"]' }, { click: "#next" }, { absent: '#progress-bar[style*="translate3d(0%"]' }],
});
