import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextField label and description content",
  summary: "Parts take content: markup inside Label, a live Text description that counts characters, and a FieldError with render-prop children.",
  tags: ["text-field", "slots"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#bio-label", "Short bio"] },
    { expect: ["#bio-label", "(optional)"] },
    { expect: ["#bio-description", "0 / 20"] },
    { absent: "#bio-error" },
    { fill: ["#bio", "Mathematician"] },
    { expect: ["#bio-description", "13 / 20"] },
    { fill: ["#bio", "Mathematician and writer"] },
    { attr: ["#bio", "aria-invalid", "true"] },
    { expect: ["#bio-error", "Error: Keep it under 20 characters."] },
    { described: ["#bio", "Keep it under 20 characters."] },
  ],
});
