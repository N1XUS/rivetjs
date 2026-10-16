import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Controlled and uncontrolled Checkbox",
  summary: "CheckboxField with isSelected as a two-way signal (also written from a button), defaultSelected for an uncontrolled box, and a drawn box.",
  tags: ["checkbox", "state"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#news", "type", "checkbox"] },
    { name: ["#news", "Send me the newsletter"] },
    { matches: ".rv-CheckboxField > label:has(#news)" },
    { matches: "#news:not(:checked)" },
    { matches: "#tips:checked" },
    { click: "label:has(#news)" },
    { matches: "#news:checked" },
    { expect: ["#cb-state", "Newsletter: yes"] },
    { matches: "label[data-selected] #news" },
    { click: "#clear" },
    { matches: "#news:not(:checked)" },
    { expect: ["#cb-state", "Newsletter: no"] },
    { press: ["#tips", "Space"] },
    { matches: "#tips:not(:checked)" },
    { matches: ".rv-CheckboxField:not([data-selected]):has(#tips)" },
  ],
});
