import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Interaction states with Tailwind",
  summary: "pressProps, hoverProps and useFocusRing write data-pressed, data-hovered and data-focus-visible; Tailwind data-[…] variants style them.",
  tags: ["cdk", "interactions", "tailwind"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { absent: "#chip[data-hovered]" },
    { click: "#chip" },
    { matches: "#chip[data-hovered]" },
    { absent: "#chip[data-pressed]" },
    { absent: "#chip[data-focus-visible]" },
    { matches: "#chip[data-focused]" },
    { expect: ["#count", "1"] },
    { press: ["#before", "Tab"] },
    { focused: "#chip" },
    { matches: "#chip[data-focus-visible]" },
  ],
});
