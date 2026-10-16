import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Motion: Button press",
  summary:
    "Rivet addition: a Motion button with the ui button styles that grows on hover and springs back from a press (@rivetjs/motion whileHover / whilePress).",
  tags: ["motion", "button"],
  status: "experimental",
  frame: { height: 120 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#saves", "0"] },
    { hover: "#save" },
    { click: "#save" },
    { expect: ["#saves", "1"] },
    { press: ["#save", "Enter"] },
    { expect: ["#saves", "2"] },
  ],
});
