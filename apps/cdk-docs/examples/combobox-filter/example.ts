import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ComboBox: filter and menu trigger",
  summary: "`defaultFilter` matches city names by prefix; `menuTrigger=\"focus\"` opens the list when the input gains focus.",
  tags: ["combobox", "filter"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: "#city" },
    { attr: ["#city", "aria-expanded", "true"] },
    { matches: '[role=option][data-key="zur"]' },
    // Prefix match: "b" keeps Berlin and Bogotá, drops Lisbon (no "b" at the start).
    { fill: ["#city", "b"] },
    { matches: '[role=option][data-key="ber"]' },
    { absent: '[role=option][data-key="lis"]' },
  ],
});
