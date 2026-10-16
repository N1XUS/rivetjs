import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DOM props in your own component",
  summary: "A SearchField component that accepts GlobalDOMAttributes and TextInputDOMEvents and forwards them with globalDOMProps and textInputDOMProps.",
  tags: ["cdk", "dom-props"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/components/SearchField.tsx", "src/routes/index.tsx"],
  test: [
    { attr: ["#field", "lang", "en"] },
    { click: "#field-input" },
    { expect: ["#log", "root:enter"] },
    { fill: ["#field-input", "rivet"] },
    // onInput is owned: the component's handler runs first, then yours.
    { expect: ["#value", "Query: rivet"] },
    { expect: ["#log", "input:rivet"] },
  ],
});
