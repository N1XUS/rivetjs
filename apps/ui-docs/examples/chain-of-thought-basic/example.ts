import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChainOfThought: Usage",
  summary: "Collapsed reasoning under a short summary; open it to read the steps.",
  tags: ["chain-of-thought"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: [".chain-of-thought__trigger", "aria-expanded", "false"] },
    { click: ".chain-of-thought__trigger" },
    { attr: [".chain-of-thought__trigger", "aria-expanded", "true"] },
    { expect: [".chain-of-thought__steps", "Annecy"] },
  ],
});
