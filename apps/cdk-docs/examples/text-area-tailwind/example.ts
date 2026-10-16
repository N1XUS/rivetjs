import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextArea with Tailwind",
  summary:
    "A TextField with a TextArea part styled with Tailwind: data-[invalid]:, focused: and data-[focus-visible]: on the textarea, group-data-[readonly]: from the root.",
  tags: ["text-area", "tailwind", "styling"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#tw-ta.rounded-md" },
    { matches: ".group[data-readonly]:has(> #tw-ta-ro)" },
    { attr: ["#tw-ta-ro", "readonly", ""] },
    { described: ["#tw-ta", "Markdown is fine."] },
    { fill: ["#tw-ta", "Looks good"] },
    { matches: "#tw-ta[data-focused]" },
  ],
});
