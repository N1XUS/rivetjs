import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NativeSelect in a TextField",
  summary: "A native select as the field part of a TextField: label, description, required validation and a two-way value signal; options and an optgroup.",
  tags: ["native-select", "forms", "state"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { name: ["#country", "Country"] },
    { described: ["#country", "We ship to these countries"] },
    { attr: ["#country", "name", "country"] },
    { matches: "#country option[value=de]:checked" },
    { expect: ["#country-value", "de"] },
    { click: "#ship-fr" },
    { matches: "#country option[value=fr]:checked" },
    { expect: ["#country-value", "fr"] },
    { matches: "#country[required]" },
  ],
});
