import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberField formats: currency, percent, units",
  summary: "formatOptions drive display and parsing (currency, percent, unit); step snaps typed values; a name submits the raw number through a hidden input.",
  tags: ["number-field", "format", "i18n", "forms", "tailwind"],
  status: "experimental",
  frame: { height: 236, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#price", "value", "$25.00"] },
    { attr: ["#discount", "value", "15%"] },
    { attr: ["#length", "value", "12 cm"] },
    { attr: ["input[type=hidden][name=price]", "value", "25"] },
    { press: ["#discount", "ArrowUp"] },
    { attr: ["#discount", "value", "20%"] },
    { fill: ["#length", "13.26"] },
    { press: ["#length", "Enter"] },
    { attr: ["#length", "value", "13.5 cm"] },
  ],
});
