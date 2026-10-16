import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Controlled and uncontrolled Switch",
  summary: "A Switch whose isSelected is a two-way signal, written from buttons too, next to an uncontrolled Switch; a track drawn from data-selected.",
  tags: ["switch", "state"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#wifi", "role", "switch"] },
    { name: ["#wifi", "Wi-Fi"] },
    { matches: "#wifi:checked" },
    { matches: "label[data-selected]:has(#wifi)" },
    { matches: "#bt:not(:checked)" },
    { press: ["#wifi", "Space"] },
    { matches: "#wifi:not(:checked)" },
    { expect: ["#sw-state", "Wi-Fi is off"] },
    { click: "#reset" },
    { matches: "#wifi:checked" },
    { expect: ["#sw-state", "Wi-Fi is on"] },
    { click: "#airplane" },
    { matches: "#wifi:not(:checked)" },
    { click: "label:has(#bt)" },
    { matches: "label[data-selected]:has(#bt)" },
  ],
});
